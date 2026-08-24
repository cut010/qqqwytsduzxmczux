import { b as createAstro, c as createComponent, m as maybeRenderHead, d as addAttribute, a as renderTemplate, r as renderComponent, e as renderSlot, f as renderHead, u as unescapeHTML } from './D4avlH1o.js';
import 'kleur/colors';
/* empty css         */

/** @returns {void} */

function run(fn) {
	return fn();
}

function blank_object() {
	return Object.create(null);
}

/**
 * @param {Function[]} fns
 * @returns {void}
 */
function run_all(fns) {
	fns.forEach(run);
}

let current_component;

/** @returns {void} */
function set_current_component(component) {
	current_component = component;
}

function get_current_component() {
	if (!current_component) throw new Error('Function called outside component initialization');
	return current_component;
}

/**
 * Schedules a callback to run immediately before the component is unmounted.
 *
 * Out of `onMount`, `beforeUpdate`, `afterUpdate` and `onDestroy`, this is the
 * only one that runs inside a server-side component.
 *
 * https://svelte.dev/docs/svelte#ondestroy
 * @param {() => any} fn
 * @returns {void}
 */
function onDestroy(fn) {
	get_current_component().$$.on_destroy.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];

let render_callbacks = [];

const flush_callbacks = [];

const resolved_promise = /* @__PURE__ */ Promise.resolve();

let update_scheduled = false;

/** @returns {void} */
function schedule_update() {
	if (!update_scheduled) {
		update_scheduled = true;
		resolved_promise.then(flush);
	}
}

/** @returns {Promise<void>} */
function tick() {
	schedule_update();
	return resolved_promise;
}

/** @returns {void} */
function add_render_callback(fn) {
	render_callbacks.push(fn);
}

// flush() calls callbacks in this order:
// 1. All beforeUpdate callbacks, in order: parents before children
// 2. All bind:this callbacks, in reverse order: children before parents.
// 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
//    for afterUpdates called during the initial onMount, which are called in
//    reverse order: children before parents.
// Since callbacks might update component values, which could trigger another
// call to flush(), the following steps guard against this:
// 1. During beforeUpdate, any updated components will be added to the
//    dirty_components array and will cause a reentrant call to flush(). Because
//    the flush index is kept outside the function, the reentrant call will pick
//    up where the earlier call left off and go through all dirty components. The
//    current_component value is saved and restored so that the reentrant call will
//    not interfere with the "parent" flush() call.
// 2. bind:this callbacks cannot trigger new flush() calls.
// 3. During afterUpdate, any updated components will NOT have their afterUpdate
//    callback called a second time; the seen_callbacks set, outside the flush()
//    function, guarantees this behavior.
const seen_callbacks = new Set();

let flushidx = 0; // Do *not* move this inside the flush() function

/** @returns {void} */
function flush() {
	// Do not reenter flush while dirty components are updated, as this can
	// result in an infinite loop. Instead, let the inner flush handle it.
	// Reentrancy is ok afterwards for bindings etc.
	if (flushidx !== 0) {
		return;
	}
	const saved_component = current_component;
	do {
		// first, call beforeUpdate functions
		// and update components
		try {
			while (flushidx < dirty_components.length) {
				const component = dirty_components[flushidx];
				flushidx++;
				set_current_component(component);
				update(component.$$);
			}
		} catch (e) {
			// reset dirty state to not end up in a deadlocked state and then rethrow
			dirty_components.length = 0;
			flushidx = 0;
			throw e;
		}
		set_current_component(null);
		dirty_components.length = 0;
		flushidx = 0;
		while (binding_callbacks.length) binding_callbacks.pop()();
		// then, once components are updated, call
		// afterUpdate functions. This may cause
		// subsequent updates...
		for (let i = 0; i < render_callbacks.length; i += 1) {
			const callback = render_callbacks[i];
			if (!seen_callbacks.has(callback)) {
				// ...so guard against infinite loops
				seen_callbacks.add(callback);
				callback();
			}
		}
		render_callbacks.length = 0;
	} while (dirty_components.length);
	while (flush_callbacks.length) {
		flush_callbacks.pop()();
	}
	update_scheduled = false;
	seen_callbacks.clear();
	set_current_component(saved_component);
}

/** @returns {void} */
function update($$) {
	if ($$.fragment !== null) {
		$$.update();
		run_all($$.before_update);
		const dirty = $$.dirty;
		$$.dirty = [-1];
		$$.fragment && $$.fragment.p($$.ctx, dirty);
		$$.after_update.forEach(add_render_callback);
	}
}

// general each functions:

function ensure_array_like(array_like_or_iterator) {
	return array_like_or_iterator?.length !== undefined
		? array_like_or_iterator
		: Array.from(array_like_or_iterator);
}

const ATTR_REGEX = /[&"<]/g;
const CONTENT_REGEX = /[&<]/g;

/**
 * Note: this method is performance sensitive and has been optimized
 * https://github.com/sveltejs/svelte/pull/5701
 * @param {unknown} value
 * @returns {string}
 */
function escape(value, is_attr = false) {
	const str = String(value);
	const pattern = is_attr ? ATTR_REGEX : CONTENT_REGEX;
	pattern.lastIndex = 0;
	let escaped = '';
	let last = 0;
	while (pattern.test(str)) {
		const i = pattern.lastIndex - 1;
		const ch = str[i];
		escaped += str.substring(last, i) + (ch === '&' ? '&amp;' : ch === '"' ? '&quot;' : '&lt;');
		last = i + 1;
	}
	return escaped + str.substring(last);
}

/** @returns {string} */
function each(items, fn) {
	items = ensure_array_like(items);
	let str = '';
	for (let i = 0; i < items.length; i += 1) {
		str += fn(items[i], i);
	}
	return str;
}

let on_destroy;

/** @returns {{ render: (props?: {}, { $$slots, context }?: { $$slots?: {}; context?: Map<any, any>; }) => { html: any; css: { code: string; map: any; }; head: string; }; $$render: (result: any, props: any, bindings: any, slots: any, context: any) => any; }} */
function create_ssr_component(fn) {
	function $$render(result, props, bindings, slots, context) {
		const parent_component = current_component;
		const $$ = {
			on_destroy,
			context: new Map(context || (parent_component ? parent_component.$$.context : [])),
			// these will be immediately discarded
			on_mount: [],
			before_update: [],
			after_update: [],
			callbacks: blank_object()
		};
		set_current_component({ $$ });
		const html = fn(result, props, bindings, slots);
		set_current_component(parent_component);
		return html;
	}
	return {
		render: (props = {}, { $$slots = {}, context = new Map() } = {}) => {
			on_destroy = [];
			const result = { title: '', head: '', css: new Set() };
			const html = $$render(result, props, {}, $$slots, context);
			run_all(on_destroy);
			return {
				html,
				css: {
					code: Array.from(result.css)
						.map((css) => css.code)
						.join('\n'),
					map: null // TODO
				},
				head: result.title + result.head
			};
		},
		$$render
	};
}

/** @returns {string} */
function add_attribute(name, value, boolean) {
	if (value == null || (boolean)) return '';
	const assignment = `="${escape(value, true)}"`;
	return ` ${name}${assignment}`;
}

const DATA_BASE = "https://raw.laisla.wtf/data";
let contentPromise = null;
let peoplePromise = null;
function loadContent() {
  if (!contentPromise) {
    contentPromise = fetch(`${DATA_BASE}/content.json`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`content.json ${r.status}`);
      return r.json();
    });
  }
  return contentPromise;
}
function loadPeople() {
  if (!peoplePromise) {
    peoplePromise = fetch(`${DATA_BASE}/participants.json`, { cache: "no-cache" }).then((r) => {
      if (!r.ok) throw new Error(`participants.json ${r.status}`);
      return r.json();
    }).then((list) => {
      const seen = /* @__PURE__ */ new Set();
      return list.map((p) => {
        let slug = p.slug;
        if (seen.has(slug)) slug = `${p.slug}-t${p.season}`;
        seen.add(slug);
        return { ...p, slug };
      });
    });
  }
  return peoplePromise;
}
const LABELS = {
  programas: { plural: "Programas", singular: "Programa" },
  debates: { plural: "Debates", singular: "Debate" },
  extras: { plural: "Extras", singular: "Extra" },
  resumenes: { plural: "Resúmenes", singular: "Resumen" }
};
function labels(id) {
  return LABELS[id] ?? { plural: id.charAt(0).toUpperCase() + id.slice(1), singular: id.charAt(0).toUpperCase() + id.slice(1) };
}
const BASURA = /* @__PURE__ */ new Set(["true", "false", "null", "undefined", "nan", "[object object]", "-", "—"]);
function textoUtil(v) {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || BASURA.has(t.toLowerCase())) return null;
  if (!/[\p{L}\p{N}]/u.test(t)) return null;
  return t;
}
function normaliseItem(raw, seasonKey, categoryId, position) {
  const category = textoUtil(raw?.category) ?? categoryId;
  return {
    ...raw,
    // La temporada la manda el contenedor, no el campo: si no coinciden, el
    // contenedor es la fuente fiable y evita enlaces rotos.
    season: seasonKey,
    category,
    contentId: textoUtil(raw?.contentId) ?? textoUtil(raw?.id) ?? String(position),
    id: textoUtil(raw?.id) ?? `${seasonKey}-${category}-${position}`,
    title: textoUtil(raw?.title) ?? `${labels(category).singular} ${position}`,
    desc: textoUtil(raw?.desc) ?? "",
    image: textoUtil(raw?.image) ?? "",
    video: Array.isArray(raw?.video) ? raw.video.filter((v) => v && textoUtil(v.url)) : []
  };
}
function sortItems(items) {
  return [...items].sort((a, b) => {
    const na = Number(a.contentId);
    const nb = Number(b.contentId);
    return (Number.isFinite(na) ? na : 1e4) - (Number.isFinite(nb) ? nb : 1e4);
  });
}
async function getSeasons() {
  const data = await loadContent();
  const declared = new Map((data.seasons ?? []).map((s) => [String(s.season), s]));
  const keys = /* @__PURE__ */ new Set([...declared.keys(), ...Object.keys(data.content ?? {})]);
  const out = [];
  for (const key of [...keys].sort((a, b) => Number(a) - Number(b))) {
    const meta = declared.get(key);
    const byCat = data.content?.[key] ?? {};
    const tabOrder = (meta?.tabs ?? []).filter((t) => t.enable !== false).map((t) => t.id);
    const catIds = [
      ...tabOrder.filter((id) => byCat[id]?.length),
      ...Object.keys(byCat).filter((id) => !tabOrder.includes(id) && byCat[id]?.length)
    ];
    const categories = [];
    const episodes = [];
    for (const id of catIds) {
      const items = sortItems(byCat[id]).map((raw, i) => normaliseItem(raw, key, id, i + 1));
      const l = labels(id);
      categories.push({
        id,
        title: l.plural,
        singular: l.singular,
        cover: meta?.cover?.[id] || items.find((e) => e.image)?.image || null,
        episodes: items
      });
      episodes.push(...items);
    }
    if (episodes.length === 0) continue;
    const cover = meta?.cover?.programas || categories[0]?.cover || null;
    out.push({
      key,
      number: Number(key),
      title: meta?.title || `Temporada ${key}`,
      cover,
      poster: meta?.tv?.programas || cover,
      categories,
      episodes,
      episodeCount: episodes.length
    });
  }
  return out;
}
const url = {
  season: (t) => `/temporada/?t=${encodeURIComponent(t)}`,
  category: (t, c) => `/temporada/?t=${encodeURIComponent(t)}&c=${encodeURIComponent(c)}`,
  episode: (it) => `/ver/?t=${encodeURIComponent(it.season)}&c=${encodeURIComponent(it.category)}&e=${encodeURIComponent(it.contentId)}`,
  person: (slug) => `/participante/?slug=${encodeURIComponent(slug)}`
};

const KIND_ORDER = ["episodio", "participante", "temporada", "seccion"];
const KIND_LABEL = {
  episodio: "Episodios",
  participante: "Participantes",
  temporada: "Temporadas",
  seccion: "Secciones"
};
const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
function buildIndex(seasons, people) {
  const out = [];
  for (const s of seasons) {
    out.push({
      title: `Temporada ${s.number}`,
      href: url.season(s.key),
      kind: "temporada",
      kindLabel: "Temporada",
      meta: `${s.episodeCount} episodios`,
      image: s.poster ?? void 0,
      haystack: norm(`temporada ${s.number} completa episodios ${s.title}`)
    });
    for (const c of s.categories) {
      out.push({
        title: `${c.title} · T${s.number}`,
        href: url.category(s.key, c.id),
        kind: "seccion",
        kindLabel: "Sección",
        meta: `${c.episodes.length} ${c.title.toLowerCase()}`,
        image: c.cover ?? void 0,
        haystack: norm(`${c.title} temporada ${s.number}`)
      });
      c.episodes.forEach((e, i) => {
        const label = `${labels(e.category).singular} ${i + 1}`;
        const repeats = e.title.trim().toLowerCase() === label.toLowerCase();
        out.push({
          title: e.title,
          href: url.episode(e),
          kind: "episodio",
          kindLabel: "Episodio",
          meta: repeats ? `Temporada ${s.number}` : `T${s.number} · ${label}`,
          image: e.image,
          haystack: norm(`${e.title} ${e.desc ?? ""}`)
        });
      });
    }
  }
  for (const p of people) {
    out.push({
      title: p.name,
      href: url.person(p.slug),
      kind: "participante",
      kindLabel: "Participante",
      meta: `T${p.season}${p.origin ? ` · ${p.origin}` : ""}`,
      image: p.image,
      haystack: norm(`${p.name} ${p.origin ?? ""} ${p.partner ?? ""} ${p.bio ?? ""}`)
    });
  }
  return out;
}
let cached = null;
function loadIndex() {
  if (!cached) {
    cached = Promise.all([getSeasons(), loadPeople().catch(() => [])]).then(
      ([s, p]) => buildIndex(s, p)
    );
  }
  return cached;
}
function search(index, query, limit = 40) {
  const terms = norm(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return index.map((h) => {
    const title = norm(h.title);
    let score = 0;
    for (const t of terms) {
      if (!h.haystack.includes(t)) return { h, score: 0 };
      if (title === t) score += 40;
      else if (title.startsWith(t)) score += 24;
      else if (title.includes(t)) score += 12;
      else score += 1;
    }
    if (h.kind === "episodio") score += 3;
    return { h, score };
  }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score || a.h.title.localeCompare(b.h.title)).slice(0, limit).map((r) => r.h);
}
function groupHits(hits) {
  return KIND_ORDER.map((kind) => ({
    kind,
    label: KIND_LABEL[kind],
    items: hits.filter((h) => h.kind === kind)
  })).filter((g) => g.items.length > 0);
}

/* src/components/ui/SearchPalette.svelte generated by Svelte v4.2.20 */

const SearchPalette = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let hits;
	let groups;
	let flat;
	let open = false;
	let query = "";
	let index = [];
	let loading = false;
	let active = 0;
	let input;
	let listEl;

	async function show() {
		open = true;
		document.documentElement.style.overflow = "hidden";
		await tick();

		if (index.length === 0 && !loading) {
			loading = true;

			try {
				index = await loadIndex();
			} finally {
				loading = false;
			}
		}
	}

	function hide() {
		open = false;
		query = "";
		active = 0;
		document.documentElement.style.overflow = "";
	}

	function onKeydown(e) {
		const typing = (/^(INPUT|TEXTAREA|SELECT)$/).test(e.target?.tagName ?? "");

		if (!open && (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) || e.key === "/" && !typing)) {
			e.preventDefault();
			show();
			return;
		}

		if (!open) return;

		if (e.key === "Escape") {
			e.preventDefault();
			hide();
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			active = Math.min(active + 1, flat.length - 1);
			scrollActive();
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			active = Math.max(active - 1, 0);
			scrollActive();
		} else if (e.key === "Enter" && flat[active]) {
			e.preventDefault();
			location.href = flat[active].href;
		}
	}

	async function scrollActive() {
		await tick();
	}

	onDestroy(() => {
		if (typeof window !== "undefined") window.removeEventListener("keydown", onKeydown);
	});

	hits = search(index, query, 24);
	groups = groupHits(hits);
	flat = groups.flatMap(g => g.items);

	{
		if (flat.length && active >= flat.length) active = flat.length - 1;
	}

	return `${open
	? `<div class="fixed inset-0 z-[10050] flex items-start justify-center p-4 pt-[10vh] sm:pt-[12vh]"><button type="button" class="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" aria-label="Cerrar buscador"></button> <div role="dialog" aria-modal="true" aria-label="Buscar" class="relative flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-isla-surface shadow-2xl"><div class="flex items-center gap-3 border-b border-white/[0.07] px-4"><svg class="h-5 w-5 flex-shrink-0 text-zinc-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.2-5.2m0 0a7.5 7.5 0 1 0-10.6-10.6 7.5 7.5 0 0 0 10.6 10.6Z"></path></svg> <input type="text" placeholder="Buscar episodios, temporadas o participantes…" class="w-full bg-transparent py-4 text-[15px] text-white outline-none placeholder:text-zinc-600"${add_attribute("this", input, 0)}${add_attribute("value", query, 0)}> <kbd class="hidden flex-shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 sm:block" data-svelte-h="svelte-1endrmq">Esc</kbd></div> <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"${add_attribute("this", listEl, 0)}>${loading
		? `<p class="px-3 py-8 text-center text-sm text-zinc-500" data-svelte-h="svelte-3jvvv2">Cargando el catálogo…</p>`
		: `${!query.trim()
			? `<p class="px-3 py-8 text-center text-sm text-zinc-500">Escribe para buscar entre ${escape(index.length)} resultados.</p>`
			: `${flat.length === 0
				? `<p class="px-3 py-8 text-center text-sm text-zinc-500">Sin resultados para «${escape(query)}»</p>`
				: `${each(groups, g => {
						return `<p class="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-zinc-600">${escape(g.label)}</p> <ul>${each(g.items, h => {
							let i = flat.indexOf(h);

							return ` <li><a${add_attribute("href", h.href, 0)}${add_attribute("data-active", i === active, 0)} class="${"flex items-center gap-3 rounded-xl px-3 py-2 transition-colors " + escape(
								i === active
								? 'bg-brand-500/15'
								: 'hover:bg-white/[0.04]',
								true
							)}">${h.image
							? `<img${add_attribute("src", h.image, 0)} alt="" class="${"h-10 w-16 flex-shrink-0 rounded-lg bg-isla-card object-cover " + escape(h.kind === 'participante' ? 'w-10 rounded-full' : '', true)}" loading="lazy">`
							: `<span class="h-10 w-16 flex-shrink-0 rounded-lg bg-isla-card"></span>`} <span class="min-w-0 flex-1"><span class="block truncate text-sm font-semibold text-white">${escape(h.title)}</span> <span class="block truncate text-xs text-zinc-500">${escape(h.meta)}</span></span> ${i === active
							? `<kbd class="hidden flex-shrink-0 rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500 sm:block" data-svelte-h="svelte-15y6dhv">↵</kbd>`
							: ``}</a> </li>`;
						})} </ul>`;
					})}`}`}`}</div> <div class="flex items-center justify-between border-t border-white/[0.07] px-4 py-2 text-[11px] text-zinc-600" data-svelte-h="svelte-89yd5u"><span class="hidden sm:inline">↑↓ para moverte · ↵ para abrir</span> <a href="/buscar/" class="font-medium text-brand-400 hover:text-brand-300">Búsqueda avanzada →</a></div></div></div>`
	: ``}`;
});

const $$Astro$1 = createAstro("https://laisla.wtf");
const $$Header = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Header;
  const path = Astro2.url.pathname.replace(/\/+$/, "") || "/";
  const links = [
    { href: "/", label: "Inicio", match: (p) => p === "/" },
    {
      href: "/temporadas/",
      label: "Temporadas",
      match: (p) => p === "/temporadas" || p === "/temporada" || p === "/ver"
    },
    {
      href: "/participantes/",
      label: "Participantes",
      match: (p) => p.startsWith("/participante")
    }
  ];
  return renderTemplate`${maybeRenderHead()}<header class="sticky top-0 z-50 border-b border-white/[0.07] bg-isla-dark/85 backdrop-blur-xl" data-astro-cid-hnhh3bfe> <nav class="mx-auto flex h-16 max-w-7xl items-center gap-1 px-4 sm:px-6 lg:px-8" aria-label="Principal" data-astro-cid-hnhh3bfe> <a href="/" class="focus-ring group mr-2 flex items-center gap-2.5 rounded-xl" aria-label="La Isla de las Tentaciones — Inicio" data-astro-cid-hnhh3bfe> <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-base ring-1 ring-brand-500/25" aria-hidden="true" data-astro-cid-hnhh3bfe>🌴</span> <span class="font-display text-lg font-bold leading-none text-white transition-colors group-hover:text-brand-400" data-astro-cid-hnhh3bfe>
La Isla
</span> </a> <ul class="hidden items-center gap-1 sm:flex" data-astro-cid-hnhh3bfe> ${links.map((l) => renderTemplate`<li data-astro-cid-hnhh3bfe> <a${addAttribute(l.href, "href")}${addAttribute(l.match(path) ? "page" : void 0, "aria-current")}${addAttribute([
    "focus-ring relative rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
    l.match(path) ? "text-white" : "text-zinc-400 hover:text-white"
  ], "class:list")} data-astro-cid-hnhh3bfe> ${l.label} ${l.match(path) && renderTemplate`<span class="absolute inset-x-3.5 -bottom-[1.35rem] h-0.5 rounded-full bg-brand-500" aria-hidden="true" data-astro-cid-hnhh3bfe></span>`} </a> </li>`)} </ul> <div class="ml-auto flex items-center gap-2" data-astro-cid-hnhh3bfe> <button type="button" data-search-trigger class="focus-ring flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] py-2 pl-3 pr-2.5 text-sm text-zinc-400 transition-colors hover:border-white/[0.16] hover:text-white" aria-label="Buscar episodios y participantes" data-astro-cid-hnhh3bfe> <svg class="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" data-astro-cid-hnhh3bfe> <path stroke-linecap="round" stroke-linejoin="round" d="m21 21-5.2-5.2m0 0a7.5 7.5 0 1 0-10.6-10.6 7.5 7.5 0 0 0 10.6 10.6Z" data-astro-cid-hnhh3bfe></path> </svg> <span class="hidden md:inline" data-astro-cid-hnhh3bfe>Buscar</span> <kbd class="ml-3 hidden rounded border border-white/10 px-1.5 py-0.5 font-sans text-[10px] text-zinc-500 md:block" data-astro-cid-hnhh3bfe>⌘K</kbd> </button> <details class="nav-menu sm:hidden" data-astro-cid-hnhh3bfe> <summary class="focus-ring flex cursor-pointer list-none items-center rounded-xl p-2 text-zinc-400 transition-colors hover:bg-white/[0.05] hover:text-white" aria-label="Abrir menú" data-astro-cid-hnhh3bfe> <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true" data-astro-cid-hnhh3bfe> <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" data-astro-cid-hnhh3bfe></path> </svg> </summary> <div class="absolute inset-x-0 top-full z-50 border-b border-white/[0.08] bg-isla-surface/95 p-3 shadow-2xl backdrop-blur-2xl" data-astro-cid-hnhh3bfe> <ul class="space-y-1" data-astro-cid-hnhh3bfe> ${links.map((l) => renderTemplate`<li data-astro-cid-hnhh3bfe> <a${addAttribute(l.href, "href")}${addAttribute(l.match(path) ? "page" : void 0, "aria-current")}${addAttribute([
    "focus-ring block rounded-xl px-4 py-3 text-sm font-medium transition-colors",
    l.match(path) ? "bg-white/[0.06] text-white" : "text-zinc-300 hover:bg-white/[0.06] hover:text-white"
  ], "class:list")} data-astro-cid-hnhh3bfe> ${l.label} </a> </li>`)} </ul> </div> </details> </div> </nav> </header> ${renderComponent($$result, "SearchPalette", SearchPalette, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/hyj/Documents/lidlt/lidlt-web/src/components/ui/SearchPalette.svelte", "client:component-export": "default", "data-astro-cid-hnhh3bfe": true })} `;
}, "/Users/hyj/Documents/lidlt/lidlt-web/src/components/ui/Header.astro", void 0);

/* src/components/ui/ExtensionNotice.svelte generated by Svelte v4.2.20 */

const ExtensionNotice = create_ssr_component(($$result, $$props, $$bindings, slots) => {

	return `${`${`${``}`}`}`;
});

/* src/components/ui/SeasonNav.svelte generated by Svelte v4.2.20 */

const SeasonNav = create_ssr_component(($$result, $$props, $$bindings, slots) => {
	let { variant = "header" } = $$props;
	let seasons = [];

	if ($$props.variant === void 0 && $$bindings.variant && variant !== void 0) $$bindings.variant(variant);

	return `${variant === 'header'
	? `${seasons.length
		? `<ul class="grid grid-cols-3 gap-1.5">${each(seasons, s => {
				return `<li><a${add_attribute("href", url.season(s.key), 0)} class="focus-ring flex flex-col rounded-xl px-3 py-2 transition-colors hover:bg-white/[0.06]"><span class="font-display text-sm font-bold text-white">T${escape(s.number)}</span> <span class="text-[11px] text-zinc-500">${escape(s.episodeCount)} eps.</span></a> </li>`;
			})}</ul>`
		: `<p class="px-2 py-3 text-sm text-zinc-500" data-svelte-h="svelte-x95tm0">Cargando temporadas…</p>`}`
	: `<ul class="grid grid-cols-2 gap-x-4 gap-y-2">${each(seasons, s => {
			return `<li><a${add_attribute("href", url.season(s.key), 0)} class="focus-ring rounded text-sm text-zinc-500 transition-colors hover:text-brand-400">Temporada ${escape(s.number)}</a> </li>`;
		})}</ul>`}`;
});

const $$Footer = createComponent(($$result, $$props, $$slots) => {
  const DESCRIPTION = "Reality show espa\xF1ol en el que cinco parejas ponen a prueba su relaci\xF3n conviviendo por separado con solteros y solteras en un para\xEDso de Rep\xFAblica Dominicana.";
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  return renderTemplate`${maybeRenderHead()}<footer class="relative z-10 mt-24 border-t border-white/[0.07]"> <div class="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8"> <div class="grid grid-cols-2 gap-8 md:grid-cols-3 lg:gap-12"> <div class="col-span-2 md:col-span-1"> <div class="mb-3 flex items-center gap-2.5"> <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-base ring-1 ring-brand-500/25" aria-hidden="true">🌴</span> <span class="font-display font-bold text-white">La Isla</span> </div> <p class="text-sm leading-relaxed text-zinc-500"> ${DESCRIPTION} </p> </div> <nav aria-labelledby="footer-seasons"> <h2 id="footer-seasons" class="mb-3 text-sm font-semibold text-white">Temporadas</h2> ${renderComponent($$result, "SeasonNav", SeasonNav, { "client:visible": true, "variant": "footer", "client:component-hydration": "visible", "client:component-path": "/Users/hyj/Documents/lidlt/lidlt-web/src/components/ui/SeasonNav.svelte", "client:component-export": "default" })} </nav> <nav aria-labelledby="footer-explore"> <h2 id="footer-explore" class="mb-3 text-sm font-semibold text-white">Explorar</h2> <ul class="space-y-2"> <li><a href="/temporadas/" class="focus-ring rounded text-sm text-zinc-500 transition-colors hover:text-brand-400">Todas las temporadas</a></li> <li><a href="/participantes/" class="focus-ring rounded text-sm text-zinc-500 transition-colors hover:text-brand-400">Participantes</a></li> <li><a href="/buscar/" class="focus-ring rounded text-sm text-zinc-500 transition-colors hover:text-brand-400">Buscador</a></li> <li><a href="/extension/" class="focus-ring rounded text-sm text-zinc-500 transition-colors hover:text-brand-400">Extensión de navegador</a></li> <li><a href="/app/" class="focus-ring rounded text-sm text-zinc-500 transition-colors hover:text-brand-400">App para Android</a></li> </ul> </nav> </div> <div class="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.05] pt-6 sm:flex-row"> <p class="text-xs text-zinc-600">
&copy; ${year} laisla.wtf · Sitio no oficial de fans. Las marcas y contenidos pertenecen a sus respectivos propietarios.
</p> </div> </div> </footer>`;
}, "/Users/hyj/Documents/lidlt/lidlt-web/src/components/ui/Footer.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$Astro = createAstro("https://laisla.wtf");
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const SITE = {
    url: "https://laisla.wtf",
    name: "La Isla de las Tentaciones",
    shortName: "La Isla",
    locale: "es_ES",
    defaultImage: "/images/og-default.jpg"
  };
  const absolute = (u) => !u ? `${SITE.url}${SITE.defaultImage}` : /^https?:\/\//i.test(u) ? u : u.startsWith("//") ? `https:${u}` : `${SITE.url}${u.startsWith("/") ? "" : "/"}${u}`;
  const {
    title,
    titleOverride,
    description,
    image,
    type = "website",
    canonical,
    noindex = false,
    schema = [],
    prev = null,
    next = null,
    publishedTime = null
  } = Astro2.props;
  const pageTitle = titleOverride ?? `${title} | ${SITE.name}`;
  const withSlash = (p) => p.endsWith("/") ? p : `${p}/`;
  const canonicalURL = new URL(withSlash(canonical ?? Astro2.url.pathname), SITE.url).href;
  const ogImage = absolute(image);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: `${SITE.url}/`,
        name: SITE.name,
        inLanguage: "es-ES",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${SITE.url}/buscar/?q={search_term_string}` },
          "query-input": "required name=search_term_string"
        }
      },
      ...schema
    ]
  };
  return renderTemplate(_a || (_a = __template(['<html lang="es"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>', '</title><meta name="description"', '><link rel="canonical"', ">", '<link rel="alternate" hreflang="es"', '><link rel="alternate" hreflang="x-default"', ">", "", '<!-- Open Graph --><meta property="og:site_name"', '><meta property="og:type"', '><meta property="og:url"', '><meta property="og:title"', '><meta property="og:description"', '><meta property="og:image"', '><meta property="og:image:alt"', '><meta property="og:locale"', ">", '<!-- Twitter --><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', '><!-- Icons / PWA --><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#09090b"><meta name="apple-mobile-web-app-title"', `><!-- The thumbnail CDN is the LCP source on nearly every page. --><link rel="preconnect" href="https://album.mediaset.es"><link rel="dns-prefetch" href="https://album.mediaset.es"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" media="print" onload="this.media='all'">`, `<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap"></noscript><!-- Antes de pintar nada: si no hay consentimiento se marca <html> y el CSS
         bloquea la p\xE1gina. As\xED no se ve el contenido un instante antes de que
         aparezca el aviso, ni el aviso a quien ya acept\xF3. --><script>
      try {
        if (!localStorage.getItem('cookie_ok')) {
          document.documentElement.classList.add('needs-consent');
        }
      } catch (e) {
        document.documentElement.classList.add('needs-consent');
      }
    <\/script><style>
      .needs-consent,
      .needs-consent body {
        overflow: hidden !important;
      }
      .needs-consent #cookie-gate {
        display: flex !important;
      }
    </style><script type="application/ld+json">`, "<\/script>", '<script defer src="/shield.js"><\/script>', '</head> <body class="flex min-h-screen flex-col bg-isla-dark text-white"> <a href="#contenido" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brand-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-black">\nSaltar al contenido\n</a> <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"> <div class="absolute -top-1/3 left-1/4 h-[400px] w-[800px] rounded-full bg-brand-500/[0.035] blur-[150px]"></div> <div class="absolute bottom-0 right-1/4 h-[300px] w-[600px] rounded-full bg-brand-600/[0.025] blur-[120px]"></div> </div> ', " ", ' <main id="contenido" class="relative z-10 flex-1"> ', " </main> ", ` <!-- Android app invite --> <div id="android-popup" class="fixed inset-x-0 bottom-0 z-[9998] hidden p-4"> <div class="mx-auto max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"> <div class="mb-4 flex items-center gap-3"> <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-2xl" aria-hidden="true">\u{1F334}</span> <div> <h2 class="font-display text-base font-bold text-white">La Isla para Android</h2> <p class="text-xs text-zinc-500">Sin navegador, sin anuncios</p> </div> </div> <div class="flex gap-3"> <button type="button" id="android-popup-close" class="focus-ring flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.04]">
Ahora no
</button> <a href="/app/" class="focus-ring flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-brand-400">
Descargar
</a> </div> </div> </div> <!--
      Consentimiento bloqueante.

      Es la puerta de la monetizaci\xF3n: los anuncios solo se cargan al aceptar,
      as\xED que hasta entonces no se puede navegar. Cubre toda la ventana con un
      velo negro, bloquea el scroll y captura el foco; el bocadillo va centrado
      abajo. La visibilidad la decide una clase en <html> puesta desde el <head>,
      de modo que ni parpadea el contenido para quien no ha aceptado ni el
      bocadillo para quien ya lo hizo.
    --> <div id="cookie-gate" class="fixed inset-0 z-[10100] hidden items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="cookie-title"> <div class="absolute inset-0 bg-black/80 backdrop-blur-[2px]"></div> <div class="relative mx-auto mb-6 w-[min(92vw,34rem)] px-4 sm:mb-10"> <div class="relative rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"> <!-- Pico del bocadillo --> <div class="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-zinc-900" aria-hidden="true"></div> <h2 id="cookie-title" class="font-display text-lg font-bold text-white">
Usamos cookies
</h2> <p class="mt-2 text-sm leading-relaxed text-zinc-400">
Utilizamos cookies propias y de terceros para analizar el tr\xE1fico y mostrar
            contenido personalizado. Para continuar navegando por la web es necesario
            aceptarlas.
</p> <button type="button" id="cookie-accept" class="focus-ring mt-5 w-full rounded-xl bg-brand-500 px-5 py-3 font-bold text-black transition-colors hover:bg-brand-400">
Aceptar y continuar
</button> </div> </div> </div> <script>
      (function () {
        // Normaliza la ruta a su forma con barra final. Las URLs se generan
        // siempre as\xED, pero un enlace antiguo o un marcador puede no llevarla.
        if (!/\\.[a-z0-9]+$/i.test(location.pathname) && !location.pathname.endsWith('/')) {
          history.replaceState(null, '', location.pathname + '/' + location.search + location.hash);
        }

        var path = location.pathname;
        var ua = navigator.userAgent || '';

        function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
        function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

        // \u2500\u2500 Puerta de consentimiento \u2500\u2500
        function loadAnalytics() {
          if (/^\\/(extension|app)(\\/|$)/.test(path)) return;
          var s = document.createElement('script');
          s.src = '/lidlt.js';
          s.defer = true;
          document.head.appendChild(s);
        }

        if (read('cookie_ok')) {
          document.documentElement.classList.remove('needs-consent');
          loadAnalytics();
        } else {
          var accept = document.getElementById('cookie-accept');
          if (accept) {
            accept.focus({ preventScroll: true });
            accept.addEventListener('click', function () {
              store('cookie_ok', '1');
              document.documentElement.classList.remove('needs-consent');
              loadAnalytics();
            });
          }

          // Mientras no acepte no se navega: ni con teclado ni con atajos.
          document.addEventListener(
            'keydown',
            function (e) {
              if (!document.documentElement.classList.contains('needs-consent')) return;
              if (e.key === 'Tab') {
                e.preventDefault();
                accept && accept.focus({ preventScroll: true });
              } else if (e.key === 'Enter' || e.key === ' ') {
                if (document.activeElement === accept) return;
                e.preventDefault();
              } else if (e.key !== 'F5' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
              }
            },
            true,
          );
        }

        // \u2500\u2500 Android app invite \u2500\u2500
        if (/Android/i.test(ua) && !read('android_popup_seen') && !/^\\/app(\\/|$)/.test(path)) {
          setTimeout(function () {
            var p = document.getElementById('android-popup');
            if (!p) return;
            p.classList.remove('hidden');
            var close = document.getElementById('android-popup-close');
            if (close) close.addEventListener('click', function () {
              p.classList.add('hidden');
              store('android_popup_seen', '1');
            });
          }, 2500);
        }

        // \u2500\u2500 Service worker \u2500\u2500
        // En local nunca: un SW cacheando CSS/JS de URLs fijas deja el
        // navegador servido con estilos de una build anterior, y el problema
        // es invisible porque no da ning\xFAn error. Si hay uno instalado de
        // antes, se elimina junto con sus cach\xE9s.
        var esLocal = /^(localhost|127\\.0\\.0\\.1|\\[::1\\])$/.test(location.hostname);

        if ('serviceWorker' in navigator) {
          if (esLocal) {
            navigator.serviceWorker.getRegistrations().then(function (rs) {
              rs.forEach(function (r) { r.unregister(); });
            }).catch(function () {});
            if (window.caches && caches.keys) {
              caches.keys().then(function (ks) {
                ks.forEach(function (k) { caches.delete(k); });
              }).catch(function () {});
            }
          } else {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function () {});
            });
          }
        }
      })();
    <\/script> </body> </html>`], ['<html lang="es"> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>', '</title><meta name="description"', '><link rel="canonical"', ">", '<link rel="alternate" hreflang="es"', '><link rel="alternate" hreflang="x-default"', ">", "", '<!-- Open Graph --><meta property="og:site_name"', '><meta property="og:type"', '><meta property="og:url"', '><meta property="og:title"', '><meta property="og:description"', '><meta property="og:image"', '><meta property="og:image:alt"', '><meta property="og:locale"', ">", '<!-- Twitter --><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title"', '><meta name="twitter:description"', '><meta name="twitter:image"', '><!-- Icons / PWA --><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/apple-touch-icon.png"><link rel="manifest" href="/manifest.webmanifest"><meta name="theme-color" content="#09090b"><meta name="apple-mobile-web-app-title"', `><!-- The thumbnail CDN is the LCP source on nearly every page. --><link rel="preconnect" href="https://album.mediaset.es"><link rel="dns-prefetch" href="https://album.mediaset.es"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap" media="print" onload="this.media='all'">`, `<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Space+Grotesk:wght@600;700&display=swap"></noscript><!-- Antes de pintar nada: si no hay consentimiento se marca <html> y el CSS
         bloquea la p\xE1gina. As\xED no se ve el contenido un instante antes de que
         aparezca el aviso, ni el aviso a quien ya acept\xF3. --><script>
      try {
        if (!localStorage.getItem('cookie_ok')) {
          document.documentElement.classList.add('needs-consent');
        }
      } catch (e) {
        document.documentElement.classList.add('needs-consent');
      }
    <\/script><style>
      .needs-consent,
      .needs-consent body {
        overflow: hidden !important;
      }
      .needs-consent #cookie-gate {
        display: flex !important;
      }
    </style><script type="application/ld+json">`, "<\/script>", '<script defer src="/shield.js"><\/script>', '</head> <body class="flex min-h-screen flex-col bg-isla-dark text-white"> <a href="#contenido" class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-brand-500 focus:px-4 focus:py-2 focus:font-semibold focus:text-black">\nSaltar al contenido\n</a> <div class="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true"> <div class="absolute -top-1/3 left-1/4 h-[400px] w-[800px] rounded-full bg-brand-500/[0.035] blur-[150px]"></div> <div class="absolute bottom-0 right-1/4 h-[300px] w-[600px] rounded-full bg-brand-600/[0.025] blur-[120px]"></div> </div> ', " ", ' <main id="contenido" class="relative z-10 flex-1"> ', " </main> ", ` <!-- Android app invite --> <div id="android-popup" class="fixed inset-x-0 bottom-0 z-[9998] hidden p-4"> <div class="mx-auto max-w-md rounded-2xl border border-white/10 bg-zinc-900 p-5 shadow-2xl"> <div class="mb-4 flex items-center gap-3"> <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-2xl" aria-hidden="true">\u{1F334}</span> <div> <h2 class="font-display text-base font-bold text-white">La Isla para Android</h2> <p class="text-xs text-zinc-500">Sin navegador, sin anuncios</p> </div> </div> <div class="flex gap-3"> <button type="button" id="android-popup-close" class="focus-ring flex-1 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/[0.04]">
Ahora no
</button> <a href="/app/" class="focus-ring flex-1 rounded-xl bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-brand-400">
Descargar
</a> </div> </div> </div> <!--
      Consentimiento bloqueante.

      Es la puerta de la monetizaci\xF3n: los anuncios solo se cargan al aceptar,
      as\xED que hasta entonces no se puede navegar. Cubre toda la ventana con un
      velo negro, bloquea el scroll y captura el foco; el bocadillo va centrado
      abajo. La visibilidad la decide una clase en <html> puesta desde el <head>,
      de modo que ni parpadea el contenido para quien no ha aceptado ni el
      bocadillo para quien ya lo hizo.
    --> <div id="cookie-gate" class="fixed inset-0 z-[10100] hidden items-end justify-center" role="dialog" aria-modal="true" aria-labelledby="cookie-title"> <div class="absolute inset-0 bg-black/80 backdrop-blur-[2px]"></div> <div class="relative mx-auto mb-6 w-[min(92vw,34rem)] px-4 sm:mb-10"> <div class="relative rounded-2xl border border-white/10 bg-zinc-900 p-6 shadow-2xl"> <!-- Pico del bocadillo --> <div class="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-b border-r border-white/10 bg-zinc-900" aria-hidden="true"></div> <h2 id="cookie-title" class="font-display text-lg font-bold text-white">
Usamos cookies
</h2> <p class="mt-2 text-sm leading-relaxed text-zinc-400">
Utilizamos cookies propias y de terceros para analizar el tr\xE1fico y mostrar
            contenido personalizado. Para continuar navegando por la web es necesario
            aceptarlas.
</p> <button type="button" id="cookie-accept" class="focus-ring mt-5 w-full rounded-xl bg-brand-500 px-5 py-3 font-bold text-black transition-colors hover:bg-brand-400">
Aceptar y continuar
</button> </div> </div> </div> <script>
      (function () {
        // Normaliza la ruta a su forma con barra final. Las URLs se generan
        // siempre as\xED, pero un enlace antiguo o un marcador puede no llevarla.
        if (!/\\\\.[a-z0-9]+$/i.test(location.pathname) && !location.pathname.endsWith('/')) {
          history.replaceState(null, '', location.pathname + '/' + location.search + location.hash);
        }

        var path = location.pathname;
        var ua = navigator.userAgent || '';

        function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
        function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

        // \u2500\u2500 Puerta de consentimiento \u2500\u2500
        function loadAnalytics() {
          if (/^\\\\/(extension|app)(\\\\/|$)/.test(path)) return;
          var s = document.createElement('script');
          s.src = '/lidlt.js';
          s.defer = true;
          document.head.appendChild(s);
        }

        if (read('cookie_ok')) {
          document.documentElement.classList.remove('needs-consent');
          loadAnalytics();
        } else {
          var accept = document.getElementById('cookie-accept');
          if (accept) {
            accept.focus({ preventScroll: true });
            accept.addEventListener('click', function () {
              store('cookie_ok', '1');
              document.documentElement.classList.remove('needs-consent');
              loadAnalytics();
            });
          }

          // Mientras no acepte no se navega: ni con teclado ni con atajos.
          document.addEventListener(
            'keydown',
            function (e) {
              if (!document.documentElement.classList.contains('needs-consent')) return;
              if (e.key === 'Tab') {
                e.preventDefault();
                accept && accept.focus({ preventScroll: true });
              } else if (e.key === 'Enter' || e.key === ' ') {
                if (document.activeElement === accept) return;
                e.preventDefault();
              } else if (e.key !== 'F5' && !e.metaKey && !e.ctrlKey) {
                e.preventDefault();
              }
            },
            true,
          );
        }

        // \u2500\u2500 Android app invite \u2500\u2500
        if (/Android/i.test(ua) && !read('android_popup_seen') && !/^\\\\/app(\\\\/|$)/.test(path)) {
          setTimeout(function () {
            var p = document.getElementById('android-popup');
            if (!p) return;
            p.classList.remove('hidden');
            var close = document.getElementById('android-popup-close');
            if (close) close.addEventListener('click', function () {
              p.classList.add('hidden');
              store('android_popup_seen', '1');
            });
          }, 2500);
        }

        // \u2500\u2500 Service worker \u2500\u2500
        // En local nunca: un SW cacheando CSS/JS de URLs fijas deja el
        // navegador servido con estilos de una build anterior, y el problema
        // es invisible porque no da ning\xFAn error. Si hay uno instalado de
        // antes, se elimina junto con sus cach\xE9s.
        var esLocal = /^(localhost|127\\\\.0\\\\.0\\\\.1|\\\\[::1\\\\])$/.test(location.hostname);

        if ('serviceWorker' in navigator) {
          if (esLocal) {
            navigator.serviceWorker.getRegistrations().then(function (rs) {
              rs.forEach(function (r) { r.unregister(); });
            }).catch(function () {});
            if (window.caches && caches.keys) {
              caches.keys().then(function (ks) {
                ks.forEach(function (k) { caches.delete(k); });
              }).catch(function () {});
            }
          } else {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function () {});
            });
          }
        }
      })();
    <\/script> </body> </html>`])), pageTitle, addAttribute(description, "content"), addAttribute(canonicalURL, "href"), noindex ? renderTemplate`<meta name="robots" content="noindex, follow">` : renderTemplate`<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">`, addAttribute(canonicalURL, "href"), addAttribute(canonicalURL, "href"), prev && renderTemplate`<link rel="prev"${addAttribute(new URL(prev, SITE.url).href, "href")}>`, next && renderTemplate`<link rel="next"${addAttribute(new URL(next, SITE.url).href, "href")}>`, addAttribute(SITE.name, "content"), addAttribute(type, "content"), addAttribute(canonicalURL, "content"), addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), addAttribute(title, "content"), addAttribute(SITE.locale, "content"), publishedTime && renderTemplate`<meta property="article:published_time"${addAttribute(publishedTime, "content")}>`, addAttribute(title, "content"), addAttribute(description, "content"), addAttribute(ogImage, "content"), addAttribute(SITE.shortName, "content"), maybeRenderHead(), unescapeHTML(JSON.stringify(jsonLd)), renderSlot($$result, $$slots["head"]), renderHead(), renderComponent($$result, "Header", $$Header, {}), renderComponent($$result, "ExtensionNotice", ExtensionNotice, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/hyj/Documents/lidlt/lidlt-web/src/components/ui/ExtensionNotice.svelte", "client:component-export": "default" }), renderSlot($$result, $$slots["default"]), renderComponent($$result, "Footer", $$Footer, {}));
}, "/Users/hyj/Documents/lidlt/lidlt-web/src/layouts/Layout.astro", void 0);

export { $$Layout as $, create_ssr_component as c };
