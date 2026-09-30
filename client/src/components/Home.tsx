import clsx from 'clsx';
import gsap from 'gsap';
import { BookOpen, ChefHat, ChevronsRight, Clock, Flame, ListChecks, Sparkles, Users, Zap } from 'lucide-react';
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
    const ctx = gsap.context(() => gsap.from('[data-intro]', { y: 34, opacity: 0, duration: 0.9, stagger: 0.08, ease: 'power3.out', clearProps: 'all' }), ref);
    return () => ctx.revert();
  }, []);
  return (
    <section className="max-w-7xl mx-auto px-4 pt-8 md:pt-12" ref={ref}>
      <div className="relative rounded-[32px] overflow-hidden glass-2 p-6 sm:p-10 md:p-14">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(60% 80% at 85% 30%, rgba(198,255,61,.16), transparent 60%), radial-gradient(50% 60% at 10% 100%, rgba(34,227,255,.12), transparent 60%)' }} />
        <div className="absolute right-4 md:right-16 top-6 bottom-6 w-[46%] hidden md:block pointer-events-none select-none" aria-hidden>
          {[['🥑', 110, '30%', '8%', 0, 'rgba(198,255,61,.35)'], ['🍓', 72, '70%', '0%', -2, 'rgba(255,61,129,.4)'], ['🍔', 88, '62%', '48%', -4, 'rgba(252,238,10,.35)'], ['🧃', 64, '14%', '58%', -1, 'rgba(34,227,255,.4)'], ['🥐', 54, '42%', '72%', -3, 'rgba(255,170,60,.3)']].map(([e, s, l, t, d, c]) => (
            <span key={e as string} className="absolute float" style={{ fontSize: s as number, left: l as string, top: t as string, animationDelay: `${d}s`, filter: `drop-shadow(0 18px 26px ${c})` }}>{e}</span>
          ))}
        </div>
        <div className="relative max-w-xl">
          <div data-intro className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold chip on mb-5"><Zap className="w-3.5 h-3.5" />Доставка от 30 минут · 5 супермаркетов в Киеве</div>
          <h1 data-intro className="font-display font-black text-[34px] leading-[1.05] sm:text-5xl md:text-6xl">Еда будущего<br /><span className="grad-text">в один клик</span></h1>
          <p data-intro className="mt-5 text-base sm:text-lg c-ink2 max-w-md">Свежие продукты с доставкой: соберите блюдо свайпом, копите кэшбэк на голографической карте и оплачивайте за секунды.</p>
          <div data-intro className="mt-7 flex flex-wrap gap-3">
            <a href="#recipes" className="btn-neon rounded-2xl px-5 py-3.5 flex items-center gap-2"><ChefHat className="w-5 h-5" />Собрать блюдо</a>
            <button onClick={() => { set({ mode: 'list' }); sfx.whoosh(); scrollTo({ top: 0 }); }} className="btn-ghost rounded-2xl px-5 py-3.5 font-bold flex items-center gap-2"><ListChecks className="w-5 h-5" />Режим супермаркета</button>
          </div>
          <div data-intro className="mt-8 grid grid-cols-3 gap-3 max-w-md">
            <div className="glass rounded-2xl p-3"><div className="font-display font-bold text-xl c-lime">{count ?? '—'}</div><div className="text-[11px] c-ink3 font-semibold">товаров</div></div>
            <div className="glass rounded-2xl p-3"><div className="font-display font-bold text-xl c-yellow">{Math.round(rate * 100)}%</div><div className="text-[11px] c-ink3 font-semibold">ваш кэшбэк</div></div>
            <div className="glass rounded-2xl p-3"><div className="font-display font-bold text-xl c-cyan">30′</div><div className="text-[11px] c-ink3 font-semibold">доставка</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Categories() {
  const data = useCatalog(s => s.data);
  const cat = useFilters(s => s.cat), setF = useFilters(s => s.set);
  const pick = (id: string) => { setF({ cat: id }); sfx.click(); };
  return (
    <section className="max-w-7xl mx-auto px-4 mt-8">
      <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 -mx-4 px-4 snap-x">
        <button onClick={() => pick('all')} className={clsx('chip snap-start shrink-0 rounded-2xl px-4 py-2.5 flex items-center gap-2 font-bold text-sm', cat === 'all' && 'on')}><span className="text-lg">🛸</span>Все</button>
        {data?.categories.map(c => (
          <button key={c.id} onClick={() => pick(c.id)} className={clsx('chip snap-start shrink-0 rounded-2xl px-4 py-2.5 flex items-center gap-2 font-bold text-sm', cat === c.id && 'on')}>
            <span className="text-lg">{c.emoji}</span>{c.name}<span className="text-[11px] font-mono opacity-60">{data.products.filter(p => p.cat === c.id).length}</span>
          </button>
        ))}
      </div>
    </section>
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
      knob.style.transition = 'transform .35s cubic-bezier(.4,0,.2,1)'; fill.style.transition = 'width .35s cubic-bezier(.4,0,.2,1)';
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
      <div className="swipe-label">Свайп → всё в корзину</div>
      <div className="swipe-knob" onPointerDown={onDown} role="slider" aria-valuenow={0} aria-label="Проведите вправо, чтобы добавить все ингредиенты"><ChevronsRight className="w-6 h-6" strokeWidth={2.6} /></div>
    </div>
  );
}

function RecipeCard({ r }: { r: Recipe }) {
  const byId = useCatalog(s => s.byId);
  const lines = useCart(s => s.lines);
  const rate = useSession(s => s.user?.tier.rate ?? 0.03);
  const set = useUi(s => s.set);
  const c = recipeCalc(r);
  const inCart = lines.some(l => l.bundle === r.id);
  return (
    <article className="snap-start shrink-0 w-[86%] sm:w-[400px] rounded-[28px] glass-2 p-5 relative overflow-hidden flex flex-col">
      <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full blur-3xl opacity-50 pointer-events-none" style={{ background: r.tint }} />
      <div className="relative flex items-start gap-4">
        <div className="badge3d"><div className="orb w-20 h-20" style={{ ['--tint' as string]: r.tint }}><span className="emo text-5xl">{r.emoji}</span></div></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1.5"><span className="ribbon rb-sale">−{Math.round(r.discount * 100)}% набор</span>{inCart && <span className="ribbon rb-new">в корзине</span>}</div>
          <h3 className="font-display font-bold text-lg leading-tight">{r.title}</h3>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs c-ink2 font-semibold">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{r.time} мин</span>
            <span className="flex items-center gap-1"><Flame className="w-3.5 h-3.5" />{r.kcal} ккал</span>
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{r.portions} порц.</span>
            <span>{r.level}</span>
          </div>
        </div>
      </div>
      <div className="relative mt-4 grid grid-cols-2 gap-1.5">
        {r.items.map(it => {
          const p = byId.get(it.productId);
          const short = p ? p.stock - lines.filter(l => l.productId === p.id).reduce((s, l) => s + l.qty, 0) < it.qty : true;
          return (
            <button key={it.productId} disabled={!p} onClick={() => p && set({ productId: p.id })} className={clsx('flex items-center gap-2 rounded-xl bg-black/25 border hairline px-2 py-1.5 text-left hover:border-white/25', short && 'opacity-40')}>
              <span className="text-lg">{p?.emoji ?? '❔'}</span>
              <span className="min-w-0 flex-1"><span className="block text-xs font-semibold truncate">{p?.name ?? 'Нет в продаже'}</span><span className="block text-[10px] c-ink3">{p ? money(p.price) : ''}</span></span>
            </button>
          );
        })}
      </div>
      <details className="relative mt-3">
        <summary className="text-xs font-bold c-ink2 cursor-pointer list-none flex items-center gap-1.5 hover:text-white"><BookOpen className="w-3.5 h-3.5" />Как приготовить</summary>
        <ol className="mt-2 space-y-1.5 text-sm c-ink2 list-decimal pl-5">{r.steps.map(s => <li key={s}>{s}</li>)}</ol>
      </details>
      <div className="relative mt-auto pt-4">
        <div className="flex items-end justify-between mb-3">
          <div><div className="text-xs c-ink3 line-through">{money(c.sum)}</div><div className="font-display font-bold text-2xl">{money(c.final)}</div></div>
          <div className="text-right text-xs"><div className="c-pink font-bold">экономия {money(c.disc)}</div><div className="c-lime font-semibold">+{Math.floor(c.final * rate)} бонусов</div></div>
        </div>
        <SwipeToAdd recipe={r} />
        <button onClick={e => addRecipe(r, e.currentTarget)} className="w-full mt-2 text-xs font-bold c-ink3 hover:text-[var(--lime)] py-1.5">или нажмите, чтобы добавить</button>
      </div>
    </article>
  );
}

export function Recipes() {
  const recipes = useCatalog(s => s.data?.recipes);
  if (!recipes?.length) return null;
  return (
    <section id="recipes" className="max-w-7xl mx-auto px-4 mt-12 scroll-mt-28">
      <div className="mb-5">
        <div className="text-xs font-bold c-lime tracking-[.2em] uppercase mb-2 flex items-center gap-2"><Sparkles className="w-4 h-4" />Smart Recipe-to-Cart</div>
        <h2 className="font-display font-bold text-2xl sm:text-3xl">Соберите блюдо в 1 свайп</h2>
        <p className="c-ink2 mt-1.5 text-sm">Все ингредиенты рецепта летят в корзину одним движением — со скидкой на набор.</p>
      </div>
      <div className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 pb-4">{recipes.map(r => <RecipeCard key={r.id} r={r} />)}</div>
    </section>
  );
}
