<?php
/**
 * プルダウンやスライダーと連動して表示内容を切り替えるプラグイン
 *
 * @version 1.3.0
 * @author kanateko
 * @link https://jpngamerswiki.com/?f51cd63681
 * @license https://www.gnu.org/licenses/gpl-3.0.html GPLv3
 */

// PukiWiki Plugin Entry Points ----------------------

function plugin_switch_init(): void
{
    $messages['_switch_messages'] = [
        'err_unknown' => '#switch Error: Unknown Argument (%s)',
        'err_empty'   => '#switch Error: No Contents',
        'err_invalid' => '#switch Error: Invalid Value (%s)',
        'err_step'    => '#switch Error: Step must be 1 or higher'
    ];
    set_plugin_messages($messages);
}

function plugin_switch_convert(): string
{
    $args = func_get_args();
    return SwitchPlugin::renderBlock($args);
}

function plugin_switch_inline(): string
{
    $args = func_get_args();
    return SwitchPlugin::renderInline($args);
}

// Main Logic Class ----------------------------------

class SwitchPlugin
{
    private const PLUGIN_NAME = 'switch';
    private const DEFAULT_GROUP = 'default';
    private const DEFAULT_SEPARATOR_INLINE = ':';
    private const DEFAULT_SEPARATOR_BLOCK = '#-';
    private const DEFAULT_RANGE_ATTRS = [1, 10, 1]; // min, max, step

    private static int $instanceCount = 0;
    private static array $groupStartIndex = [];
    private static bool $assetsLoaded = false;

    /**
     * Render block type (#switch)
     */
    public static function renderBlock(array $args): string
    {
        return self::render('block', $args);
    }

    /**
     * Render inline type (&switch)
     */
    public static function renderInline(array $args): string
    {
        return self::render('inline', $args);
    }

    private static function render(string $renderType, array $args): string
    {
        $options = self::parseOptions($args);
        if (isset($options['error'])) {
            return self::showError($options['error'], $options['error_val'] ?? '');
        }

        $items = self::parseItems($options['body'], $renderType, $options['separator']);
        if (empty($items)) {
            if ($options['type'] === 'number' || $options['type'] === 'linear') {
                $items = ['', '', self::DEFAULT_RANGE_ATTRS[2]];
            } else {
                return self::showError('err_empty');
            }
        }

        $id = self::PLUGIN_NAME . '_' . self::$instanceCount++;
        $group = $options['group'];
        self::$groupStartIndex[$group] ??= $options['start'] ?? 0;

        $wrapperClass = "plugin-switch switch-{$options['type']}{$options['class']}";
        if (defined('PKWK_SKIN_DARK_THEME') && PKWK_SKIN_DARK_THEME) {
            $wrapperClass .= ' plugin-switch--dark';
        }

        $html = match ($options['type']) {
            'select' => self::renderSelect($id, $group, $items, $options, $wrapperClass),
            'range'  => self::renderRange($id, $group, $items, $options, $wrapperClass),
            'number' => self::renderNumber($id, $group, $items, $options, $wrapperClass),
            'linear' => self::renderLinear($id, $group, $items, $options, $wrapperClass),
            default  => self::renderDefault($id, $group, $items, $options, $renderType, $wrapperClass),
        };

        return self::loadAssets() . $html;
    }

    private static function parseOptions(array $args): array
    {
        $options = [
            'type'      => 'default',
            'group'     => self::DEFAULT_GROUP,
            'separator' => null,
            'start'     => null,
            'label'     => null,
            'class'     => '',
            'width'     => null,
            'flags'     => [],
            'body'      => '',
        ];

        if (empty($args)) return ['error' => 'err_empty'];

        $options['body'] = array_pop($args);

        foreach ($args as $arg) {
            $arg = htmlsc($arg);
            if (strpos($arg, '=') !== false) {
                [$key, $val] = array_map('trim', explode('=', $arg, 2));
                switch ($key) {
                    case 'group':
                        $options['group'] = $val;
                        break;
                    case 'separator':
                        $options['separator'] = $val;
                        break;
                    case 'type':
                        if (in_array($val, ['select', 'range', 'number', 'linear', 'default'])) {
                            $options['type'] = $val;
                        }
                        break;
                    case 'start':
                        if (is_numeric($val)) {
                            $options['start'] = max(0, (int)$val - 1);
                        }
                        break;
                    case 'label':
                        $options['label'] = $val;
                        break;
                    case 'class':
                        $options['class'] .= ' ' . $val;
                        break;
                    case 'input-width':
                    case 'slider-width':
                        if (preg_match('/^(\d+)(px|%|em|rem|[lsd]?v([wh]|min|max))?$/', $val, $m)) {
                            $unit = $m[2] ?? 'px';
                            $options['width'] = $m[1] . $unit;
                        }
                        break;
                    default:
                        return ['error' => 'err_unknown', 'error_val' => $arg];
                }
            } else {
                if (in_array($arg, ['select', 'range', 'number', 'linear', 'default'])) {
                    $options['type'] = $arg;
                } elseif (in_array($arg, ['transparent', 'disable', 'rtl'])) {
                    $options['flags'][] = $arg;
                } else {
                    $options['group'] = ltrim($arg, '~');
                }
            }
        }

        return $options;
    }

    private static function parseItems(string $body, string $renderType, ?string $separator): array
    {
        $body = trim($body);
        if ($body === '') return [];

        $sep = $separator ?? ($renderType === 'block' ? self::DEFAULT_SEPARATOR_BLOCK : self::DEFAULT_SEPARATOR_INLINE);
        
        $evac = [];
        if ($renderType === 'block') {
            // Block type: evacuate nested plugins
            if (preg_match_all('/#.+?({{2,})/', $body, $m)) {
                foreach ($m[0] as $i => $start) {
                    $end = str_replace('{', '}', $m[1][$i]);
                    if (preg_match('/' . preg_quote($start) . '[\s\S]+?' . $end . '/', $body, $m_evac)) {
                        $evac[$i] = $m_evac[0];
                        $body = str_replace($m_evac[0], "{evac$i}", $body);
                    }
                }
            }
        } else {
            // Inline type: evacuate HTML tags
            if (preg_match_all('/<.+?>/', $body, $m)) {
                foreach ($m[0] as $i => $tag) {
                    $evac[$i] = $tag;
                    $body = str_replace($tag, "{evac$i}", $body);
                }
            }
        }

        $items = explode($sep, $body);
        foreach ($items as &$item) {
            $item = trim($item);
            
            if (!empty($evac)) {
                foreach ($evac as $i => $content) {
                    $item = str_replace("{evac$i}", $content, $item);
                }
            }

            if ($renderType === 'block') {
                $item = convert_html(explode("\n", str_replace(["\r\n", "\r"], "\n", $item)));
            }
        }

        return $items;
    }

    private static function renderSelect(string $id, string $group, array $items, array $options, string $wrapperClass): string
    {
        $label = $options['label'] ? "<label for=\"$id\" class=\"switch-label\">{$options['label']}</label>" : '';
        $style = $options['width'] ? " style=\"width:{$options['width']}\"" : '';
        $dataAttrs = " data-group=\"" . htmlsc($group) . "\"";
        foreach ($options['flags'] as $flag) {
            $dataAttrs .= " data-$flag";
        }

        $optionsHtml = '';
        $startIndex = self::$groupStartIndex[$group];
        foreach ($items as $i => $item) {
            $selected = ($i === $startIndex) ? ' selected' : '';
            $optionsHtml .= "<option value=\"$i\"$selected>" . strip_tags($item) . "</option>\n";
        }

        return "$label<select id=\"$id\" class=\"$wrapperClass\"$style$dataAttrs>\n$optionsHtml</select>";
    }

    private static function renderRange(string $id, string $group, array $items, array $options, string $wrapperClass): string
    {
        [$min, $max, $step] = self::getRangeAttrs($items);
        if ($step <= 0) return self::showError('err_step');

        $startIndex = self::$groupStartIndex[$group];
        $initialValue = $min + ($startIndex * $step);

        if ($initialValue < $min || $initialValue > $max) {
            return self::showError('err_invalid', "start:$initialValue out of range [$min, $max]");
        }

        $label = $options['label'] ? "<label for=\"$id\" class=\"switch-label\">{$options['label']}</label>" : '';
        $style = $options['width'] ? " style=\"width:{$options['width']}\"" : '';
        $displayValue = number_format($initialValue, self::getDecimals($step));

        return "$label<input type=\"range\" id=\"$id\" class=\"$wrapperClass\"$style data-group=\"" . htmlsc($group) . "\" min=\"$min\" max=\"$max\" step=\"$step\" value=\"$initialValue\"><output>$displayValue</output>";
    }

    private static function renderNumber(string $id, string $group, array $items, array $options, string $wrapperClass): string
    {
        [$min, $max, $step] = self::getRangeAttrs($items, true);
        if ($step <= 0) return self::showError('err_step');

        $startIndex = self::$groupStartIndex[$group];
        $initialValue = self::calculateValue($startIndex, $min, $max, $step);

        $label = $options['label'] ? "<label for=\"$id\" class=\"switch-label\">{$options['label']}</label>" : '';
        $style = $options['width'] ? " style=\"width:{$options['width']}\"" : '';

        return "$label<input type=\"number\" id=\"$id\" class=\"$wrapperClass\"$style data-group=\"" . htmlsc($group) . "\" min=\"$min\" max=\"$max\" step=\"$step\" value=\"$initialValue\">";
    }

    private static function renderLinear(string $id, string $group, array $items, array $options, string $wrapperClass): string
    {
        [$min, $max, $step] = self::getRangeAttrs($items, true);
        $startIndex = self::$groupStartIndex[$group];
        $initialValue = self::calculateValue($startIndex, $min, $max, $step);

        $displayValue = number_format($initialValue, self::getDecimals($step));
        $dataAttrs = " data-group=\"" . htmlsc($group) . "\" data-min=\"$min\" data-max=\"$max\" data-step=\"$step\"";

        return "<span id=\"$id\" class=\"$wrapperClass\"$dataAttrs>$displayValue</span>";
    }

    private static function renderDefault(string $id, string $group, array $items, array $options, string $renderType, string $wrapperClass): string
    {
        $tag = ($renderType === 'block') ? 'div' : 'span';
        $startIndex = self::$groupStartIndex[$group];
        
        $itemsHtml = '';
        foreach ($items as $i => $item) {
            $selected = ($i === $startIndex) ? ' data-selected' : '';
            $itemsHtml .= "<$tag class=\"switch-item\"$selected>$item</$tag>";
        }

        return "<$tag id=\"$id\" class=\"$wrapperClass\" data-group=\"" . htmlsc($group) . "\">$itemsHtml</$tag>";
    }

    private static function getRangeAttrs(array $items, bool $allowInf = false): array
    {
        $min = ($allowInf && $items[0] === '') ? -INF : (isset($items[0]) && is_numeric($items[0]) ? (float)$items[0] : self::DEFAULT_RANGE_ATTRS[0]);
        $max = ($allowInf && $items[1] === '') ? INF : (isset($items[1]) && is_numeric($items[1]) ? (float)$items[1] : self::DEFAULT_RANGE_ATTRS[1]);
        $step = (isset($items[2]) && is_numeric($items[2])) ? (float)$items[2] : self::DEFAULT_RANGE_ATTRS[2];
        return [$min, $max, $step];
    }

    private static function calculateValue(int $index, float $min, float $max, float $step): float
    {
        $val = ($step > 0) ? $min + ($index * $step) : $max + ($index * $step);
        if (is_infinite($val)) $val = $index * $step;
        return max($min, min($max, $val));
    }

    private static function getDecimals(float $val): int
    {
        $str = (string)$val;
        $pos = strpos($str, '.');
        return ($pos === false) ? 0 : strlen($str) - $pos - 1;
    }

    private static function showError(string $key, string $val = ''): string
    {
        global $_switch_messages;
        $msg = $_switch_messages[$key] ?? $key;
        if ($val !== '') $msg = str_replace('%s', htmlsc($val), $msg);
        return "<p class=\"plugin-switch-error\">$msg</p>";
    }

    private static function loadAssets(): string
    {
        if (self::$assetsLoaded) return '';
        self::$assetsLoaded = true;

        $css = '/* minified css here */';
        $js = '/* minified js here */';

        $injection = '';
        if ($css) {
            $injection = "if(!document.getElementById('plugin-switch-style')){const s=document.createElement('style');s.id='plugin-switch-style';s.textContent=`$css`;document.head.appendChild(s);}";
        }

        return "<script type=\"module\">$injection$js</script>";
    }
}
