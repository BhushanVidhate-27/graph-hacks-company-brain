import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import type { RecordId } from "@/lib/evidence";

export function Citation({ id, label = "Decision" }: { id: RecordId; label?: string }) {
  return (
    <Link className="citation" to="/sources" search={{ record: id }}>
      {label} {id} <ArrowUpRight aria-hidden="true" size={15} />
    </Link>
  );
}
