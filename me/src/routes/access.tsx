import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Get early access — NOMORE" },
      {
        name: "description",
        content: "Request early access to NOMORE and give your organization a company brain.",
      },
      { property: "og:title", content: "Get early access to NOMORE" },
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

const fields = [
  { name: "name", label: "Name", type: "text", autoComplete: "name" },
  { name: "email", label: "Work email", type: "email", autoComplete: "email" },
  { name: "company", label: "Company", type: "text", autoComplete: "organization" },
] as const;
const sizes = ["1–50", "51–500", "501–5k", "5k+"];

function Access() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const confirmation = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (done) confirmation.current?.focus();
  }, [done]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const next: Record<string, string> = {};
    for (const field of fields) {
      const input = form.elements.namedItem(field.name) as HTMLInputElement;
      if (!input.value.trim()) next[field.name] = "Enter your " + field.label.toLowerCase() + ".";
      else if (!input.validity.valid) next[field.name] = "Enter a valid email address.";
    }
    setErrors(next);
    const first = Object.keys(next)[0];
    if (first) (form.elements.namedItem(first) as HTMLInputElement).focus();
    else setDone(true);
  }
  return (
    <div className="access-page page">
      <header>
        <img className="access-impression" src="/illustrations/impression.svg" alt="" />
        <h1 className="page-title">Early access.</h1>
        <p>Try the request form. This preview keeps your details in this browser tab.</p>
      </header>
      {done ? (
        <section className="confirmation glass" aria-live="polite">
          <img className="confirmation-imprint" src="/illustrations/the-imprint.svg" alt="" />
          <h2 ref={confirmation} tabIndex={-1}>
            Preview complete.
          </h2>
          <p>Your details passed validation. This demo does not send an access request.</p>
          <button type="button" className="text-link" onClick={() => setDone(false)}>
            Back to form
          </button>
        </section>
      ) : (
        <form className="access-form glass" noValidate onSubmit={submit}>
          {fields.map(({ name, label, type, autoComplete }) => (
            <div className="field" key={name}>
              <label htmlFor={name}>{label}</label>
              <input
                name={name}
                id={name}
                type={type}
                autoComplete={autoComplete}
                required
                aria-invalid={Boolean(errors[name])}
                aria-describedby={errors[name] ? name + "-error" : undefined}
                onInput={(e) => {
                  if (
                    errors[name] &&
                    e.currentTarget.validity.valid &&
                    e.currentTarget.value.trim()
                  )
                    setErrors((previous) => ({ ...previous, [name]: "" }));
                }}
              />
              {errors[name] && (
                <p className="field-error" id={name + "-error"}>
                  {errors[name]}
                </p>
              )}
            </div>
          ))}
          <fieldset>
            <legend>Team size</legend>
            <div className="sizes">
              {sizes.map((size, i) => (
                <label key={size}>
                  <input type="radio" name="size" value={size} defaultChecked={i === 1} />
                  <span>{size}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="action action-light">
            Preview request <ArrowRight aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
}
