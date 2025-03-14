"use client";

import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { useState } from "react";

export default function App() {
  return (
    <>
      <header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800">
        Convex + React
      </header>
      <main className="p-8 flex flex-col gap-16">
        <h1 className="text-4xl font-bold text-center">Convex + React</h1>
        <Content />
      </main>
    </>
  );
}

function Content() {
  const [result, setResult] = useState<any>(null);
  const runWorkflow = useAction(api.node.a);

  return (
    <div className="flex flex-col gap-8 max-w-lg mx-auto">
      <p>
        <button
          className="bg-foreground text-background text-sm px-4 py-2 rounded-md"
          onClick={() => {
            void runWorkflow().then((res) => {
              setResult(res);
            });
          }}
        >
          Run the workflow
        </button>
      </p>
      <p>{JSON.stringify(result)}</p>
    </div>
  );
}
