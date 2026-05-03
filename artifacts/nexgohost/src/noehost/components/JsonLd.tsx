import { useEffect } from "react";

export function JsonLd({ id, schema }: { id: string; schema: object }) {
  useEffect(() => {
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.id = id;
    script.text = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => { document.getElementById(id)?.remove(); };
  }, [id, JSON.stringify(schema)]);
  return null;
}
