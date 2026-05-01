"use client";

import dynamic from "next/dynamic";

const DataFlowDiagram = dynamic(() => import("@/components/DataFlowDiagram"), {
  ssr: false,
});

export default function DataFlowDiagramLazy() {
  return <DataFlowDiagram />;
}
