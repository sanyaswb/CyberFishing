"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const acorn = require("acorn");
const walk = { simple(node, visitors) {
  if (!node || typeof node !== "object") return;
  visitors[node.type]?.(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child=>walk.simple(child,visitors));
    else if (value && typeof value === "object") walk.simple(value,visitors);
  }
} };

// Synchronous ESM evaluation for the existing synchronous VM checks. Each loader owns one
// module cache in its VM realm. Only this test adapter publishes explicitly requested names.
// Production/browser code uses the browser's native module loader.
class NativeEsmTestLoader {
  #root;
  #context;
  #modules = new Map();
  #loading = new Set();

  constructor({ projectRoot, context, moduleStubs = {} }) {
    this.#root = path.resolve(projectRoot);
    this.#context = context;
    for (const [file,namespace] of Object.entries(moduleStubs)) this.#modules.set(file,namespace);
  }

  hasModule(file) {
    return /^(?:src\/(?:dev|engine|game|platform|bootstrap|entrypoints)\/)/u.test(file);
  }


  get namespaces() { return [...this.#modules.values()]; }

  getExports(file) {
    const target=file;
    if (this.#modules.has(target)) return this.#modules.get(target);
    if (this.#loading.has(target)) throw new Error("Native test import cycle: " + target);
    this.#loading.add(target);
    try {
      const source=fs.readFileSync(path.join(this.#root,target),"utf8");
      const tree=acorn.parse(source,{ecmaVersion:"latest",sourceType:"module"});
      const edits=[], imports=[], bindings=[], exports=[];
      for (const node of tree.body) {
        if (node.type === "ImportDeclaration") {
          const index=imports.length;
          const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(target),node.source.value));
          if (!node.source.value.startsWith(".") || !node.source.value.endsWith(".js")) throw new Error("Explicit native test import required: " + target);
          imports.push(this.getExports(dependency));
          for (const item of node.specifiers) {
            if (item.type !== "ImportSpecifier") throw new Error("Named native test import required: " + target);
            bindings.push(`const ${item.local.name}=__imports[${index}][${JSON.stringify(item.imported.name)}];`);
          }
          edits.push({start:node.start,end:node.end,text:""});
        } else if (node.type === "ExportNamedDeclaration") {
          if (node.source) throw new Error("Test re-export is unsupported: " + target);
          if (node.declaration) {
            const declaration=node.declaration;
            const names=declaration.type === "VariableDeclaration" ? declaration.declarations.map(item=>item.id.name) : [declaration.id.name];
            if (names.some(name=>!name)) throw new Error("Simple named test export required: " + target);
            exports.push(...names.map(name=>[name,name]));
            edits.push({start:node.start,end:declaration.start,text:""});
          } else {
            exports.push(...node.specifiers.map(item=>[item.exported.name,item.local.name]));
            edits.push({start:node.start,end:node.end,text:""});
          }
        } else if (node.type === "ExportDefaultDeclaration" || node.type === "ExportAllDeclaration") throw new Error("Named native test exports required: " + target);
      }
      walk.simple(tree,{ImportExpression:node=> {
        if (node.source.type !== "Literal" || typeof node.source.value !== "string") throw new Error("Literal dynamic test import required: " + target);
        const dependency=path.posix.normalize(path.posix.join(path.posix.dirname(target),node.source.value));
        edits.push({start:node.start,end:node.end,text:`__dynamic(${JSON.stringify(dependency)})`});
      }});
      let body=source;
      for (const edit of edits.sort((a,b)=>b.start-a.start)) body=body.slice(0,edit.start)+edit.text+body.slice(edit.end);
      const namespace=Object.create(null);
      const publish=exports.map(([name,local])=>`Object.defineProperty(__exports,${JSON.stringify(name)},{enumerable:true,get:()=>${local}});`).join("\n");
      const factory=vm.runInContext(`(function(__imports,__dynamic,__exports){"use strict";\n${bindings.join("\n")}\n${body}\n${publish}\n})`,this.#context,{filename:target});
      factory(imports,dependency=>Promise.resolve().then(()=>this.getExports(dependency)),namespace);
      if (process.env.CYBER_CLASS_TRACE_OUTPUT)
        require("../../architecture/stage_four/class_trace_probe").registerNativeNamespace(this.#context,namespace);
      Object.freeze(namespace);
      this.#modules.set(target,namespace);
      return namespace;
    } finally { this.#loading.delete(target); }
  }

  load(file,names=[]) {
    const namespace=this.getExports(file);
    // Explicit export publication is limited to this test VM.
    Object.assign(this.#context,namespace);
    if (this.#context.globalThis && this.#context.globalThis !== this.#context)
      Object.assign(this.#context.globalThis,namespace);
    // Existing negative fixtures request a deliberately absent export and assert undefined.
    for (const name of names) if (!(name in this.#context)) this.#context[name] = undefined;
    return file;
  }

  loadAll(files) { for (const file of files) this.load(file); }
}

module.exports={NativeEsmTestLoader};
