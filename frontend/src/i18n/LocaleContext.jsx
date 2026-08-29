import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  getLocaleFromPath,
  getStoredLocale,
  normalizeLocale,
  parseLocalizedPath,
  routePath,
  switchLocalePath,
  translateUiText,
} from "./locale.js";

const LocaleContext = createContext(null);

function setOrCreateLink(rel, attrs) {
  const selectorParts = [`link[rel="${rel}"]`];
  if (attrs.hreflang) selectorParts.push(`[hreflang="${attrs.hreflang}"]`);
  let element = document.head.querySelector(selectorParts.join(""));
  if (!element) {
    element = document.createElement("link");
    element.rel = rel;
    document.head.appendChild(element);
  }
  Object.entries(attrs).forEach(([key, value]) => {
    if (value) element.setAttribute(key, value);
  });
  return element;
}

function shouldSkipNode(node) {
  const parent = node?.parentElement;
  if (!parent) return true;
  return Boolean(parent.closest("script,style,code,pre,.admin-shell,[data-no-translate='true']"));
}

function LocaleDomTranslator({ locale }) {
  const textStateRef = useRef(new WeakMap());
  const attrStateRef = useRef(new WeakMap());

  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return undefined;

    const translateTextNode = (node) => {
      if (!node?.nodeValue || shouldSkipNode(node)) return;
      const states = textStateRef.current;
      const previous = states.get(node);
      const current = node.nodeValue;

      if (locale === "en") {
        const source = previous && current === previous.translated ? previous.source : current;
        const translated = translateUiText(source, locale);
        states.set(node, { source, translated });
        if (translated !== current) node.nodeValue = translated;
      } else if (previous && current === previous.translated) {
        node.nodeValue = previous.source;
        states.delete(node);
      }
    };

    const translateElementAttributes = (element) => {
      if (!(element instanceof Element)) return;
      if (element.closest(".admin-shell,[data-no-translate='true']")) return;
      const attributes = ["placeholder", "title", "aria-label", "alt"];
      let state = attrStateRef.current.get(element) || {};

      attributes.forEach((attribute) => {
        if (!element.hasAttribute(attribute)) return;
        const current = element.getAttribute(attribute) || "";
        const previous = state[attribute];

        if (locale === "en") {
          const source = previous && current === previous.translated ? previous.source : current;
          const translated = translateUiText(source, locale);
          state[attribute] = { source, translated };
          if (translated !== current) element.setAttribute(attribute, translated);
        } else if (previous && current === previous.translated) {
          element.setAttribute(attribute, previous.source);
          delete state[attribute];
        }
      });

      if (Object.keys(state).length > 0) attrStateRef.current.set(element, state);
      else attrStateRef.current.delete(element);
    };

    const walk = (startNode) => {
      if (!startNode) return;
      if (startNode.nodeType === Node.TEXT_NODE) {
        translateTextNode(startNode);
        return;
      }
      if (startNode.nodeType !== Node.ELEMENT_NODE && startNode.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return;

      if (startNode.nodeType === Node.ELEMENT_NODE) translateElementAttributes(startNode);
      const walker = document.createTreeWalker(startNode, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
      let current = walker.nextNode();
      while (current) {
        if (current.nodeType === Node.TEXT_NODE) translateTextNode(current);
        else translateElementAttributes(current);
        current = walker.nextNode();
      }
    };

    walk(root);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "characterData") translateTextNode(mutation.target);
        if (mutation.type === "attributes") translateElementAttributes(mutation.target);
        mutation.addedNodes.forEach(walk);
      });
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "alt"],
    });

    return () => observer.disconnect();
  }, [locale]);

  return null;
}

export function LocaleProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const localeFromPath = getLocaleFromPath(location.pathname);
  const locale = normalizeLocale(localeFromPath || getStoredLocale() || DEFAULT_LOCALE);

  useEffect(() => {
    document.documentElement.lang = locale;
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {}
  }, [locale]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const nativeAlert = window.alert.bind(window);
    const nativeConfirm = window.confirm.bind(window);

    window.alert = (message) => nativeAlert(translateUiText(message, locale));
    window.confirm = (message) => nativeConfirm(translateUiText(message, locale));

    return () => {
      window.alert = nativeAlert;
      window.confirm = nativeConfirm;
    };
  }, [locale]);

  useEffect(() => {
    const info = parseLocalizedPath(location.pathname);
    if (!info.locale) return;
    const origin = window.location.origin;
    const idPath = routePath("id", info.key, info.params);
    const enPath = routePath("en", info.key, info.params);
    const currentPath = locale === "en" ? enPath : idPath;

    setOrCreateLink("canonical", { href: `${origin}${currentPath}` });
    setOrCreateLink("alternate", { hreflang: "id", href: `${origin}${idPath}` });
    setOrCreateLink("alternate", { hreflang: "en", href: `${origin}${enPath}` });
    setOrCreateLink("alternate", { hreflang: "x-default", href: `${origin}${idPath}` });
  }, [locale, location.pathname]);

  const route = useCallback((key, params = {}) => routePath(locale, key, params), [locale]);

  const changeLocale = useCallback((nextLocale) => {
    const target = normalizeLocale(nextLocale);
    if (target === locale) return;
    const next = switchLocalePath(location.pathname, target, location.hash);
    navigate(next, { replace: false, state: location.state });
  }, [locale, location.hash, location.pathname, location.state, navigate]);

  const t = useCallback((idText, enText) => {
    if (locale === "en") return enText ?? translateUiText(idText, "en");
    return idText;
  }, [locale]);

  const value = useMemo(() => ({
    locale,
    isEnglish: locale === "en",
    route,
    changeLocale,
    t,
  }), [changeLocale, locale, route, t]);

  return (
    <LocaleContext.Provider value={value}>
      {children}
      <LocaleDomTranslator locale={locale} />
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale harus dipakai di dalam LocaleProvider.");
  return value;
}
