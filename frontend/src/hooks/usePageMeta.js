import { useEffect } from "react";
import { useLocale } from "../i18n/LocaleContext.jsx";

// Dynamic title, description, Open Graph metadata, and canonical URL.
function usePageMeta(title, description, ogImage) {
  const { locale } = useLocale();

  useEffect(() => {
    const previousTitle = document.title;
    if (title) document.title = `${title} — Morgen Geschäft`;

    const setMeta = (property, content) => {
      if (!content) return;
      let element = document.querySelector(`meta[property="${property}"]`) || document.querySelector(`meta[name="${property}"]`);
      if (!element) {
        element = document.createElement("meta");
        if (property.startsWith("og:")) element.setAttribute("property", property);
        else element.setAttribute("name", property);
        document.head.appendChild(element);
      }
      element.setAttribute("content", content);
    };

    if (description) {
      setMeta("description", description);
      setMeta("og:description", description);
    }
    if (title) setMeta("og:title", `${title} — Morgen Geschäft`);
    if (ogImage) setMeta("og:image", ogImage);
    setMeta("og:locale", locale === "en" ? "en_US" : "id_ID");

    const canonicalUrl = `${window.location.origin}${window.location.pathname}`;
    let canonicalElement = document.querySelector('link[rel="canonical"]');
    if (!canonicalElement) {
      canonicalElement = document.createElement("link");
      canonicalElement.setAttribute("rel", "canonical");
      document.head.appendChild(canonicalElement);
    }
    canonicalElement.setAttribute("href", canonicalUrl);
    setMeta("og:url", canonicalUrl);

    return () => { document.title = previousTitle; };
  }, [title, description, ogImage, locale]);
}

export { usePageMeta };
