/**
 * MinHeap implementation for A* pathfinding performance optimization
 */

export interface HeapNode<T> {
  item: T;
  priority: number;
}

export class MinHeap<T> {
  private heap: HeapNode<T>[] = [];

  constructor() {}

  size(): number {
    return this.heap.length;
  }

  isEmpty(): boolean {
    return this.heap.length === 0;
  }

  /**
   * Insert item with priority
   */
  insert(item: T, priority: number): void {
    const node: HeapNode<T> = { item, priority };
    this.heap.push(node);
    this.heapifyUp(this.heap.length - 1);
  }

  /**
   * Extract minimum priority item
   */
  extractMin(): T | null {
    if (this.isEmpty()) {
      return null;
    }

    if (this.heap.length === 1) {
      const node = this.heap.pop();
      return node ? node.item : null;
    }

    const min = this.heap[0];
    const last = this.heap.pop();
    if (min && last) {
      this.heap[0] = last;
      this.heapifyDown(0);
      return min.item;
    }

    return null;
  }

  /**
   * Peek at minimum without extracting
   */
  peek(): T | null {
    const first = this.heap[0];
    return first ? first.item : null;
  }

  /**
   * Get minimum priority
   */
  peekPriority(): number {
    const first = this.heap[0];
    return first ? first.priority : Infinity;
  }

  /**
   * Check if heap contains item (linear search)
   */
  contains(item: T, compareFn?: (a: T, b: T) => boolean): boolean {
    const compare = compareFn || ((a, b) => a === b);
    return this.heap.some((node) => compare(node.item, item));
  }

  /**
   * Update priority of existing item
   * Returns true if item was found and updated
   */
  updatePriority(
    item: T,
    newPriority: number,
    compareFn?: (a: T, b: T) => boolean
  ): boolean {
    const compare = compareFn || ((a, b) => a === b);

    for (let i = 0; i < this.heap.length; i++) {
      const node = this.heap[i];
      if (node && compare(node.item, item)) {
        const oldPriority = node.priority;
        node.priority = newPriority;

        if (newPriority < oldPriority) {
          this.heapifyUp(i);
        } else if (newPriority > oldPriority) {
          this.heapifyDown(i);
        }
        return true;
      }
    }
    return false;
  }

  private heapifyUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      const current = this.heap[index];
      const parent = this.heap[parentIndex];

      if (!current || !parent || current.priority >= parent.priority) {
        break;
      }

      this.swap(index, parentIndex);
      index = parentIndex;
    }
  }

  private heapifyDown(index: number): void {
    while (true) {
      let minIndex = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      const current = this.heap[minIndex];
      const left = this.heap[leftChild];
      const right = this.heap[rightChild];

      if (
        leftChild < this.heap.length &&
        left &&
        current &&
        left.priority < current.priority
      ) {
        minIndex = leftChild;
      }

      const newCurrent = this.heap[minIndex];
      if (
        rightChild < this.heap.length &&
        right &&
        newCurrent &&
        right.priority < newCurrent.priority
      ) {
        minIndex = rightChild;
      }

      if (minIndex === index) {
        break;
      }

      this.swap(index, minIndex);
      index = minIndex;
    }
  }

  private swap(i: number, j: number): void {
    const nodeI = this.heap[i];
    const nodeJ = this.heap[j];
    if (nodeI && nodeJ) {
      this.heap[i] = nodeJ;
      this.heap[j] = nodeI;
    }
  }

  /**
   * Clear all items
   */
  clear(): void {
    this.heap = [];
  }

  /**
   * Get all items (for debugging)
   */
  getAllItems(): T[] {
    return this.heap.map((node) => node.item);
  }
}
