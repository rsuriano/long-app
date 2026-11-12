import { Suspense } from "react";
import { BuildWizard } from "@/components/BuildWizard";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BuildWizard />
    </Suspense>
  );
}
