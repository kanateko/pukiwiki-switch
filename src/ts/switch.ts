/**
 * Switch Plugin TypeScript Implementation
 */

interface SwitchOptions {
  id: string;
  group: string;
  type: 'select' | 'range' | 'number' | 'linear' | 'exponential' | 'default';
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
    } else if (this.type === 'linear' || this.type === 'exponential') {
      const val = this.calculateValue(index);
      this.element.textContent = val.toLocaleString(undefined, {
        minimumFractionDigits: this.getDecimals(),
        maximumFractionDigits: this.getDecimals()
      });
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
    const min = this.getMin();
    const max = this.getMax();
    const step = this.getStep();

    let val: number;
    if (this.type === 'exponential') {
      val = min * Math.pow(step, index);
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

  private getDecimals(): number {
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

export {};
