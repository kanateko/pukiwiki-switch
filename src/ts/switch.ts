/**
 * Switch Plugin TypeScript Implementation
 */

interface SwitchOptions {
  id: string;
  group: string;
  type: 'select' | 'range' | 'number' | 'linear' | 'exponential' | 'calc' | 'default';
  min?: number;
  max?: number;
  step?: number;
}

class SwitchInstance {
  private element: HTMLElement;
  private id: string;
  private group: string;
  private type: string;
  private output?: HTMLElement;

  constructor(el: HTMLElement) {
    this.element = el;
    this.id = el.id;
    this.group = el.dataset.group || 'default';
    
    if (el.classList.contains('switch-select')) this.type = 'select';
    else if (el.classList.contains('switch-range')) this.type = 'range';
    else if (el.classList.contains('switch-number')) this.type = 'number';
    else if (el.classList.contains('switch-linear')) this.type = 'linear';
    else if (el.classList.contains('switch-exponential')) this.type = 'exponential';
    else if (el.classList.contains('switch-calc')) this.type = 'calc';
    else this.type = 'default';

    if (this.type === 'range') {
      this.output = el.nextElementSibling as HTMLElement;
      this.updateTrackProgress();
    }

    this.init();
  }

  private init(): void {
    if (['select', 'range', 'number'].includes(this.type)) {
      this.element.addEventListener('input', (e) => {
        const index = this.getCurrentIndex();
        this.syncGroup(index);
        if (this.type === 'range') this.updateTrackProgress();
      });
    }
  }

  private getCurrentIndex(): number {
    if (this.type === 'select') {
      return (this.element as HTMLSelectElement).selectedIndex;
    }

    const val = parseFloat((this.element as HTMLInputElement).value);
    const min = this.getMin();
    const max = this.getMax();
    const step = this.getStep();

    if (this.type === 'range' || this.type === 'number') {
        const base = isFinite(min) ? min : (isFinite(max) ? max : 0);
        return Math.round((val - base) / step);
    }

    return 0;
  }

  public update(index: number): void {
    if (this.type === 'select') {
      const select = this.element as HTMLSelectElement;
      if (index >= 0 && index < select.options.length) {
        select.selectedIndex = index;
      } else {
        select.selectedIndex = select.options.length - 1;
      }
    } else if (this.type === 'range' || this.type === 'number') {
      const input = this.element as HTMLInputElement;
      const val = this.calculateValue(index);
      input.value = val.toString();
      if (this.output) {
        this.output.textContent = val.toLocaleString(undefined, {
            minimumFractionDigits: this.getDecimals(),
            maximumFractionDigits: this.getDecimals()
        });
      }
      if (this.type === 'range') this.updateTrackProgress();
    } else if (this.type === 'linear' || this.type === 'exponential' || this.type === 'calc') {
      const val = this.calculateValue(index);
      if (isNaN(val) || !isFinite(val)) {
        this.element.textContent = 'Error';
      } else {
        this.element.textContent = val.toLocaleString(undefined, {
          minimumFractionDigits: this.getDecimals(val),
          maximumFractionDigits: this.getDecimals(val)
        });
      }
    } else if (this.type === 'default') {
      const items = this.element.querySelectorAll('.switch-item');
      const targetIndex = Math.min(index, items.length - 1);
      items.forEach((item, i) => {
        if (i === targetIndex) {
          (item as HTMLElement).dataset.selected = '';
        } else {
          delete (item as HTMLElement).dataset.selected;
        }
      });
    }
  }

  private calculateValue(index: number): number {
    if (this.type === 'calc') {
      const formula = this.element.dataset.calc || '';
      try {
        return SwitchFormulaEvaluator.evaluate(formula, index);
      } catch (e) {
        console.error(e);
        return NaN;
      }
    }

    const min = this.getMin();
    const max = this.getMax();
    const step = this.getStep();

    let val: number;
    if (this.type === 'exponential') {
      let base = (step >= 1.0) ? min : max;
      if (!isFinite(base)) {
        const other = (step >= 1.0) ? max : min;
        base = isFinite(other) ? other : (step >= 1.0 ? 1 : 10);
      }
      val = base * Math.pow(step, index);
    } else {
      val = (step > 0) ? min + (index * step) : max + (index * step);
      if (isNaN(val) || !isFinite(val)) val = index * step;
    }
    
    return Math.max(min, Math.min(max, val));
  }

  private getMin(): number {
    const val = this.element.dataset.min || (this.element as HTMLInputElement).min;
    if (val === '-INF') return -Infinity;
    return val ? parseFloat(val) : 1;
  }

  private getMax(): number {
    const val = this.element.dataset.max || (this.element as HTMLInputElement).max;
    if (val === 'INF') return Infinity;
    return val ? parseFloat(val) : 10;
  }

  private getStep(): number {
    const val = this.element.dataset.step || (this.element as HTMLInputElement).step;
    return val ? parseFloat(val) : 1;
  }

  private getDecimals(val?: number): number {
    const decimals = this.element.dataset.decimals;
    if (decimals !== undefined) return parseInt(decimals);

    if (this.type === 'calc' && val !== undefined) {
      const str = val.toString();
      const pos = str.indexOf('.');
      return (pos === -1) ? 0 : str.length - pos - 1;
    }

    const step = this.getStep();
    const str = step.toString();
    const pos = str.indexOf('.');
    return (pos === -1) ? 0 : str.length - pos - 1;
  }

  private syncGroup(index: number): void {
    const instances = window.switchPluginInstances?.get(this.group);
    if (instances) {
      // Clean up disconnected instances
      const activeInstances = instances.filter(inst => inst.getElement().isConnected);
      window.switchPluginInstances!.set(this.group, activeInstances);

      activeInstances.forEach(inst => {
        if (inst.getId() !== this.id) {
          inst.update(index);
        } else if (this.type === 'range' && this.output) {
            // Range input updates its own output
            const val = parseFloat((this.element as HTMLInputElement).value);
            this.output.textContent = val.toLocaleString(undefined, {
                minimumFractionDigits: this.getDecimals(),
                maximumFractionDigits: this.getDecimals()
            });
        }
      });
    }
  }

  private updateTrackProgress(): void {
    if (this.type !== 'range') return;
    const input = this.element as HTMLInputElement;
    const min = parseFloat(input.min) || 0;
    const max = parseFloat(input.max) || 100;
    const val = parseFloat(input.value);
    const percentage = (val - min) / (max - min) * 100;
    input.style.setProperty('--range-progress', `${percentage}%`);
  }

  public getId(): string { return this.id; }
  public getElement(): HTMLElement { return this.element; }
}

declare global {
  interface Window {
    switchPluginInstances?: Map<string, SwitchInstance[]>;
  }
}

function initAll(): void {
  window.switchPluginInstances ??= new Map();
  const elements = document.querySelectorAll('.plugin-switch');
  
  elements.forEach(el => {
    const group = (el as HTMLElement).dataset.group || 'default';
    let groupInstances = window.switchPluginInstances!.get(group);
    if (!groupInstances) {
      groupInstances = [];
      window.switchPluginInstances!.set(group, groupInstances);
    }
    
    // Check if already initialized for this specific element
    const existingIndex = groupInstances.findIndex(inst => inst.getId() === el.id);
    if (existingIndex !== -1) {
      const existing = groupInstances[existingIndex];
      // If the element is the same and still connected, skip
      if (existing.getElement() === el && el.isConnected) {
        return;
      }
      // Otherwise, remove the old instance
      groupInstances.splice(existingIndex, 1);
    }
    
    groupInstances.push(new SwitchInstance(el as HTMLElement));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}

class SwitchFormulaEvaluator {
  private static operators: Record<string, { prec: number; assoc: 'L' | 'R' }> = {
    '+': { prec: 1, assoc: 'L' },
    '-': { prec: 1, assoc: 'L' },
    '*': { prec: 2, assoc: 'L' },
    '/': { prec: 2, assoc: 'L' },
    '%': { prec: 2, assoc: 'L' },
    '**': { prec: 3, assoc: 'R' }
  };

  private static functions = ['pow', 'min', 'max', 'abs', 'floor', 'ceil', 'round', 'sqrt'];

  public static evaluate(expr: string, x: number): number {
    const tokens = this.tokenize(expr);
    const rpn = this.shuntingYard(tokens);
    return this.evaluateRPN(rpn, x);
  }

  private static tokenize(expr: string): string[] {
    const pattern = /\*\*|[0-9]+(?:\.[0-9]+)?|[a-zA-Z_][a-zA-Z0-9_]*|[\+\-\*\/\%\(\),]/g;
    return expr.match(pattern) || [];
  }

  private static shuntingYard(tokens: string[]): Array<{ type: string; val: any }> {
    const outputQueue: Array<{ type: string; val: any }> = [];
    const operatorStack: Array<{ type: string; val: string }> = [];

    for (const token of tokens) {
      if (!isNaN(Number(token))) {
        outputQueue.push({ type: 'num', val: parseFloat(token) });
      } else if (token === 'x') {
        outputQueue.push({ type: 'var', val: 'x' });
      } else if (this.functions.includes(token)) {
        operatorStack.push({ type: 'func', val: token });
      } else if (token === ',') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].val !== '(') {
          outputQueue.push(operatorStack.pop()!);
        }
        if (operatorStack.length === 0) {
          throw new Error("Mismatched parentheses or comma");
        }
      } else if (this.operators[token]) {
        const op1 = token;
        while (operatorStack.length > 0) {
          const op2 = operatorStack[operatorStack.length - 1];
          if (op2.type === 'op' && (
            (this.operators[op1].assoc === 'L' && this.operators[op1].prec <= this.operators[op2.val].prec) ||
            (this.operators[op1].assoc === 'R' && this.operators[op1].prec < this.operators[op2.val].prec)
          )) {
            outputQueue.push(operatorStack.pop()!);
          } else {
            break;
          }
        }
        operatorStack.push({ type: 'op', val: op1 });
      } else if (token === '(') {
        operatorStack.push({ type: 'paren', val: '(' });
      } else if (token === ')') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].val !== '(') {
          outputQueue.push(operatorStack.pop()!);
        }
        if (operatorStack.length === 0) {
          throw new Error("Mismatched parentheses");
        }
        operatorStack.pop(); // Pop '('
        if (operatorStack.length > 0 && operatorStack[operatorStack.length - 1].type === 'func') {
          outputQueue.push(operatorStack.pop()!);
        }
      } else {
        throw new Error("Invalid token: " + token);
      }
    }

    while (operatorStack.length > 0) {
      const op = operatorStack.pop()!;
      if (op.val === '(' || op.val === ')') {
        throw new Error("Mismatched parentheses");
      }
      outputQueue.push(op);
    }

    return outputQueue;
  }

  private static evaluateRPN(rpn: Array<{ type: string; val: any }>, x: number): number {
    const stack: number[] = [];

    for (const token of rpn) {
      if (token.type === 'num') {
        stack.push(token.val);
      } else if (token.type === 'var') {
        stack.push(x);
      } else if (token.type === 'op') {
        if (stack.length < 2) throw new Error("Invalid expression");
        const b = stack.pop()!;
        const a = stack.pop()!;
        switch (token.val) {
          case '+': stack.push(a + b); break;
          case '-': stack.push(a - b); break;
          case '*': stack.push(a * b); break;
          case '/':
            if (b === 0) throw new Error("Division by zero");
            stack.push(a / b);
            break;
          case '%':
            if (b === 0) throw new Error("Division by zero");
            stack.push(a % b);
            break;
          case '**':
            stack.push(Math.pow(a, b));
            break;
        }
      } else if (token.type === 'func') {
        const func = token.val;
        if (['abs', 'floor', 'ceil', 'round', 'sqrt'].includes(func)) {
          if (stack.length < 1) throw new Error("Invalid function arguments");
          const a = stack.pop()!;
          switch (func) {
            case 'abs': stack.push(Math.abs(a)); break;
            case 'floor': stack.push(Math.floor(a)); break;
            case 'ceil': stack.push(Math.ceil(a)); break;
            case 'round': stack.push(Math.round(a)); break;
            case 'sqrt':
              if (a < 0) throw new Error("Square root of negative number");
              stack.push(Math.sqrt(a));
              break;
          }
        } else if (['pow', 'min', 'max'].includes(func)) {
          if (stack.length < 2) throw new Error("Invalid function arguments");
          const b = stack.pop()!;
          const a = stack.pop()!;
          switch (func) {
            case 'pow': stack.push(Math.pow(a, b)); break;
            case 'min': stack.push(Math.min(a, b)); break;
            case 'max': stack.push(Math.max(a, b)); break;
          }
        }
      }
    }

    if (stack.length !== 1) throw new Error("Invalid expression");
    return stack[0];
  }
}

export {};
