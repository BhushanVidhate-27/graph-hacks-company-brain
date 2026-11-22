import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { PageHero } from "@/components/site/PageHero";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Get early access — Helio" },
      {
        name: "description",
        content: "Request early access to Helio and give your organization a company brain.",
      },
      { property: "og:title", content: "Get early access to Helio" },
      {
        property: "og:description",
        content: "Be among the first organizations with a living company brain.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Access,
});

const sizes = ["1–50", "51–500", "501–5k", "5k+"];

function Access() {
  const [size, setSize] = useState(sizes[1]);
  const [done, setDone] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setDone(true);
    toast.success("You're on the list.");
  };

  return (
    <>
      <PageHero
        eyebrow="Early access"
        title={
          <>
            Give your company
            <br />
            <span className="text-solar-gradient">a brain.</span>
          </>
        }
      />
      <section className="px-4 pb-16">
        <div className="glass-strong mx-auto max-w-md rounded-[32px] p-8">
          {done ? (
            <div className="py-10 text-center animate-in fade-in">
              <span className="bg-solar-gradient glow-solar mx-auto flex size-14 items-center justify-center rounded-full text-primary-foreground">
                <Check className="size-6" />
              </span>
              <h2 className="display mt-6 text-3xl">You're on the list.</h2>
              <p className="mt-2 text-muted-foreground">We'll be in touch soon.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <Field id="name" label="Name" placeholder="Jane Appleseed" />
              <Field id="email" label="Work email" type="email" placeholder="jane@company.com" />
              <Field id="company" label="Company" placeholder="Company name" />
              <div className="space-y-2">
                <Label className="text-[13px] text-muted-foreground">Team size</Label>
                <div className="grid grid-cols-4 gap-1 rounded-full bg-glass p-1">
                  {sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      className={`rounded-full py-2 text-[13px] transition-all ${size === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <Button type="submit" size="lg" variant="solar" className="w-full">
                Request access
              </Button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-[13px] text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        name={id}
        type={type}
        required
        placeholder={placeholder}
        className="h-12 rounded-2xl border-glass-border bg-glass px-4 text-[15px]"
      />
    </div>
  );
}
