import clsx from 'clsx';
import gsap from 'gsap';
import { ArrowRight, ChevronsRight, Clock, Flame, Users } from 'lucide-react';
import { useEffect, useRef, type PointerEvent } from 'react';
import { addRecipe, recipeCalc } from '../lib/actions';
import { money } from '../lib/format';
import { sfx } from '../lib/sound';
import { useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { Recipe } from '../types';
import { useFilters } from './filters';

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const count = useCatalog(s => s.data?.products.length);
  const rate = useSession(s => s.user?.tier.rate ?? 0.03);
  const set = useUi(s => s.set);
  useEffect(() => {
    if (!ref.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => gsap.from('[data-intro]', { y: 28, opacity: 0, filter: 'blur(8px)', duration: 1.4, stagger: 0.09, ease: 'expo.out', clearProps: 'all' }), ref);
    return () => ctx.revert();
  }, []);
  return (
    <section ref={ref} className="max-w-6xl mx-auto px-5 pt-32 md:pt-44 pb-10 md:pb-16 text-center">
      <div data-intro className="eyebrow">Доставка от 30 минут · Киев и вся Украина</div>
      <h1 data-intro className="font-display text-[44px] leading-[1.02] sm:text-7xl md:text-[92px] mt-6 chrome-text">Свежие продукты.<br />Ничего лишнего.</h1>
      <p data-intro className="mt-7 text-base sm:text-lg c-ink2 max-w-xl mx-auto leading-relaxed">Соберите блюдо одним жестом, копите кэшбэк на стеклянной карте и оплачивайте за секунды.</p>
      <div data-intro className="mt-10 flex flex-wrap justify-center gap-3">
        <a href="#catalog" className="btn-neon rounded-full px-7 h-12 inline-flex items-center gap-2 text-[15px]">Перейти к покупкам <ArrowRight className="w-4 h-4" strokeWidth={1.75} /></a>
        <button onClick={() => { set({ mode: 'list' }); sfx.whoosh(); scrollTo({ top: 0 }); }} className="btn-ghost rounded-full px-7 h-12 text-[15px]">Список покупок</button>
      </div>
      <div data-intro className="mt-16 flex justify-center gap-10 sm:gap-16 text-left">
        {[[count ?? '—', 'товаров'], [`${Math.round(rate * 100)}%`, 'ваш кэшбэк'], ['30′', 'до двери']].map(([v, l]) => (
          <div key={l}><div className="font-display text-3xl sm:text-4xl">{v}</div><div className="text-xs c-ink3 mt-1">{l}</div></div>
        ))}
      </div>
    </section>
  );
}

export function Categories() {
  const data = useCatalog(s => s.data);
  const cat = useFilters(s => s.cat), setF = useFilters(s => s.set);
  const pick = (id: string) => { setF({ cat: id }); sfx.click(); };
  return (
    <div className="flex gap-1 overflow-x-auto no-scrollbar -mx-5 px-5 pb-1">
      <button onClick={() => pick('all')} className={clsx('chip shrink-0 rounded-full px-4 h-10 text-sm', cat === 'all' && 'on')}>Всё</button>
      {data?.categories.map(c => (
        <button key={c.id} onClick={() => pick(c.id)} className={clsx('chip shrink-0 rounded-full px-4 h-10 text-sm flex items-center gap-2', cat === c.id && 'on')}>
          <span className="text-base">{c.emoji}</span>{c.name}
        </button>
      ))}
    </div>
  );
}

function SwipeToAdd({ recipe }: { recipe: Recipe }) {
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const knob = e.currentTarget, track = knob.parentElement!, fill = track.querySelector<HTMLElement>('.swipe-fill')!;
    const max = track.clientWidth - knob.offsetWidth - 8, x0 = e.clientX; let dx = 0;
    try { knob.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    knob.style.transition = fill.style.transition = 'none';
    const move = (ev: globalThis.PointerEvent) => { dx = Math.min(max, Math.max(0, ev.clientX - x0)); knob.style.transform = `translateX(${dx}px)`; fill.style.width = dx + 56 + 'px'; };
    const up = () => {
      knob.removeEventListener('pointermove', move); knob.removeEventListener('pointerup', up); knob.removeEventListener('pointercancel', up);
      knob.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)'; fill.style.transition = 'width .7s cubic-bezier(.16,1,.3,1)';
      if (dx >= max * 0.8) {
        knob.style.transform = `translateX(${max}px)`; fill.style.width = '100%'; track.classList.add('done');
        addRecipe(recipe, knob);
        setTimeout(() => { knob.style.transform = ''; fill.style.width = ''; track.classList.remove('done'); }, 1500);
      } else { knob.style.transform = ''; fill.style.width = ''; if (dx > 10) sfx.click(); }
    };
    knob.addEventListener('pointermove', move); knob.addEventListener('pointerup', up); knob.addEventListener('pointercancel', up);
  };
  return (
    <div className="swipe-track">
      <div className="swipe-fill" />
      <div className="swipe-label">Проведите — всё в корзину</div>
      <div className="swipe-knob" onPointerDown={onDown} role="slider" aria-valuenow={0} aria-label="Проведите вправо, чтобы добавить все ингредиенты"><ChevronsRight className="w-5 h-5" strokeWidth={1.75} /></div>
    </div>
  );
}

function RecipeCard({ r }: { r: Recipe }) {
  const byId = useCatalog(s => s.byId);
  const lines = useCart(s => s.lines);
  const set = useUi(s => s.set);
  const c = recipeCalc(r);
  const inCart = lines.some(l => l.bundle === r.id);
  return (
    <article className="glass glass-i snap-start shrink-0 w-[86%] sm:w-[380px] rounded-[36px] p-7 flex flex-col">
      <div className="flex items-start justify-between">
        <div className="text-[72px] leading-none float" style={{ filter: 'drop-shadow(0 20px 22px rgba(0,0,0,.25))' }}>{r.emoji}</div>
        <span className="ribbon">{inCart ? 'в корзине' : `−${Math.round(r.discount * 100)}% набор`}</span>
      </div>
      <h3 className="font-display text-2xl mt-6">{r.title}</h3>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs c-ink3">
        <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" strokeWidth={1.75} />{r.time} мин</span>
        <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5" strokeWidth={1.75} />{r.kcal} ккал</span>
        <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" strokeWidth={1.75} />{r.portions} порц.</span>
      </div>
      <div className="mt-6 flex flex-wrap gap-1.5">
        {r.items.map(it => {
          const p = byId.get(it.productId);
          const short = p ? p.stock - lines.filter(l => l.productId === p.id).reduce((s, l) => s + l.qty, 0) < it.qty : true;
          return <button key={it.productId} disabled={!p} onClick={() => p && set({ productId: p.id })} title={p?.name} className={clsx('chip rounded-full pl-2 pr-3 h-8 text-xs flex items-center gap-1.5 well', short && 'opacity-40')}><span className="text-sm">{p?.emoji ?? '·'}</span><span className="truncate max-w-[110px]">{p?.name.split(' ')[0] ?? '—'}</span></button>;
        })}
      </div>
      <details className="mt-4 group">
        <summary className="text-xs c-ink3 cursor-pointer list-none hover:text-[var(--ink)]">Как приготовить →</summary>
        <ol className="mt-3 space-y-1.5 text-sm c-ink2 list-decimal pl-5">{r.steps.map(s => <li key={s}>{s}</li>)}</ol>
      </details>
      <div className="mt-auto pt-7">
        <div className="flex items-baseline justify-between mb-4">
          <div className="font-display text-3xl">{money(c.final)}</div>
          <div className="text-xs c-ink3"><span className="line-through">{money(c.sum)}</span> · −{money(c.disc)}</div>
        </div>
        <SwipeToAdd recipe={r} />
        <button onClick={e => addRecipe(r, e.currentTarget)} className="w-full mt-2 text-xs c-ink3 hover:text-[var(--ink)] py-1.5">или нажмите</button>
      </div>
    </article>
  );
}

export function Recipes() {
  const recipes = useCatalog(s => s.data?.recipes);
  if (!recipes?.length) return null;
  return (
    <section id="recipes" className="max-w-6xl mx-auto px-5 py-16 md:py-24 scroll-mt-24">
      <div className="max-w-xl">
        <div className="eyebrow">Рецепт в корзину</div>
        <h2 className="font-display text-4xl md:text-5xl mt-4">Блюдо одним жестом</h2>
        <p className="c-ink2 mt-4 leading-relaxed">Все ингредиенты рецепта — в корзину одним свайпом, со скидкой на набор.</p>
      </div>
      <div className="flex gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-5 px-5 pt-12 pb-8">{recipes.map(r => <RecipeCard key={r.id} r={r} />)}</div>
    </section>
  );
}
