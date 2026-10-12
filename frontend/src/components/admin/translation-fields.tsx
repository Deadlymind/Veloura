"use client";
import { useI18n } from "@/components/i18n-provider";
import { Field } from "./shared";
export type Translations = { fr?: Record<string, string> };
const labels: Record<string, string> = {
  name: "Name",
  subtitle: "Short introduction",
  description: "Description",
  ingredients: "Ingredients",
  usage: "Usage instructions",
  details: "Product details",
  attribute: "Product type",
  shade: "Shade name",
  size: "Size",
  alt: "Alt text",
};
export function TranslationFields({
  fields,
  value,
  onChange,
}: {
  fields: string[];
  value?: Translations;
  onChange?: (value: Translations) => void;
}) {
  const { t } = useI18n();
  return (
    <details className="translation-fields">
      <summary>{t("French translations")}</summary>
      <p className="admin-help">
        {t("Optional. Empty French fields use the English text.")}
      </p>
      {fields.map((field) => (
        <Field
          key={field}
          label={`${t(labels[field] || field)} — ${t("French")}`}
        >
          <textarea
            lang="fr"
            name={`fr_${field}`}
            rows={
              ["description", "ingredients", "usage", "details"].includes(field)
                ? 3
                : 1
            }
            maxLength={
              ["description", "ingredients", "usage", "details"].includes(field)
                ? 10000
                : 250
            }
            {...(onChange
              ? {
                  value: value?.fr?.[field] || "",
                  onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
                    onChange({
                      fr: { ...value?.fr, [field]: event.target.value },
                    }),
                }
              : { defaultValue: value?.fr?.[field] || "" })}
          />
        </Field>
      ))}
    </details>
  );
}
export function collectTranslations(form: FormData) {
  const fr: Record<string, string> = {};
  for (const [key, value] of [...form.entries()])
    if (key.startsWith("fr_")) {
      fr[key.slice(3)] = String(value).trim();
      form.delete(key);
    }
  form.set("translations", JSON.stringify({ fr }));
  return form;
}
