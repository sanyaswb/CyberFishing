class TarjanStronglyConnectedComponents {
  find(graph) {
    const adjacency = new Map(graph.nodes.map((node) => [node, []]));
    for (const edge of graph.edges) {
      if (!adjacency.has(edge.source)) adjacency.set(edge.source, []);
      adjacency.get(edge.source).push(edge.target);
    }
    for (const targets of adjacency.values()) targets.sort();
    let index = 0;
    const indices = new Map(), low = new Map(), stack = [], onStack = new Set(), components = [];
    const visit = (node) => {
      indices.set(node, index); low.set(node, index); index += 1; stack.push(node); onStack.add(node);
      for (const target of adjacency.get(node) || []) {
        if (!indices.has(target)) { visit(target); low.set(node, Math.min(low.get(node), low.get(target))); }
        else if (onStack.has(target)) low.set(node, Math.min(low.get(node), indices.get(target)));
      }
      if (low.get(node) === indices.get(node)) {
        const component = []; let current;
        do { current = stack.pop(); onStack.delete(current); component.push(current); } while (current !== node);
        components.push(component.sort());
      }
    };
    for (const node of [...adjacency.keys()].sort()) if (!indices.has(node)) visit(node);
    return components.sort((a, b) => a[0].localeCompare(b[0]));
  }

  canonicalCycle(component, graph) {
    const members = new Set(component), start = [...component].sort()[0];
    const adjacency = new Map(component.map((node) => [node, []]));
    for (const edge of graph.edges) if (members.has(edge.source) && members.has(edge.target)) adjacency.get(edge.source).push(edge.target);
    for (const targets of adjacency.values()) targets.sort();
    const queue = (adjacency.get(start) || []).map((node) => [start, node]);
    while (queue.length) {
      const path = queue.shift(), tail = path[path.length - 1];
      if (tail === start) return path;
      for (const next of adjacency.get(tail) || []) if (next === start || !path.includes(next)) queue.push([...path, next]);
      queue.sort((a, b) => a.length - b.length || a.join("\u0000").localeCompare(b.join("\u0000")));
    }
    return [...component, start];
  }
}

module.exports = { TarjanStronglyConnectedComponents };
