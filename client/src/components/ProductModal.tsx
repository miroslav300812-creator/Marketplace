import clsx from 'clsx';
import { BadgeCheck, Coins, MessageSquareHeart, Minus, Send, ShoppingCart, Star, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../api';
import { addToCart } from '../lib/actions';
import { Barcode } from '../lib/codes';
import { discountPct, money, timeAgo } from '../lib/format';
import { sfx } from '../lib/sound';
import { qtyOf, useCart } from '../store/cart';
import { useCatalog } from '../store/catalog';
import { useSession } from '../store/session';
import { useUi } from '../store/ui';
import type { Product, Review } from '../types';
import { PhoneAuth } from './PhoneAuth';
import { CloseBtn, Orb, Overlay, Ribbon, Spinner, Stars, useSheetDrag, useTint } from './ui';

const EMOJI = ['😍', '🔥', '👌', '🤤', '📦', '⭐', '💚', '🍽️', '📸', '🥳'];
const LIKED_KEY = 'nm_liked';
const readLiked = (): number[] => { try { return JSON.parse(localStorage.getItem(LIKED_KEY) ?? '[]'); } catch { return []; } };

type Detail = { product: Product; reviews: Review[]; dist: number[] };

function ReviewForm({ productId, onSent }: { productId: number; onSent: (r: Review) => void }) {
  const user = useSession(s => s.user);
  const toast = useUi(s => s.toast);
  const [rating, setRating] = useState(0), [hover, setHover] = useState(0);
  const [text, setText] = useState(''), [name, setName] = useState(user?.name ?? '');
  const [emojis, setEmojis] = useState<string[]>([]);
  const [err, setErr] = useState(''), [sending, setSending] = useState(false);
  if (!user) return <div className="mt-5"><div className="text-sm font-bold mb-2">Чтобы оставить отзыв, подтвердите телефон</div><PhoneAuth /></div>;
  const submit = async () => {
    if (!rating) { setErr('Поставьте оценку звёздами'); sfx.error(); return; }
    if (text.trim().length < 10) { setErr('Напишите хотя бы 10 символов'); sfx.error(); return; }
    setSending(true); setErr('');
    try {
      const r = await api.post<Review>(`/products/${productId}/reviews`, { rating, text, author: name, emojis });
      onSent(r); setRating(0); setText(''); setEmojis([]); sfx.success();
      toast({ type: 'ok', title: 'Отзыв отправлен', msg: 'Статус: «Ожидает проверки» — модератор проверит его в ближайшее время' });
    } catch (e) { setErr((e as Error).message); sfx.error(); } finally { setSending(false); }
  };
  const labels = ['Выберите оценку', 'Ужасно', 'Плохо', 'Нормально', 'Хорошо', 'Отлично!'];
  return (
    <div className="mt-5 rounded-3xl glass p-4">
      <div className="font-bold text-sm mb-3">Оставить отзыв</div>
      <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => { setRating(s); sfx.click(); }} onMouseEnter={() => setHover(s)} className={clsx('p-0.5 star', (hover || rating) >= s && 'on')} aria-label={`${s} звёзд`}>
            <Star className="w-7 h-7 fill-current tr hover:scale-125" strokeWidth={1.5} />
          </button>
        ))}
        <span className="ml-2 text-xs c-ink3 font-semibold">{labels[hover || rating]}</span>
      </div>
      <input value={name} onChange={e => setName(e.target.value)} className="field mt-3 text-sm" placeholder="Ваше имя" aria-label="Имя" />
      <textarea value={text} onChange={e => setText(e.target.value)} rows={3} className="field mt-2 text-sm resize-none" placeholder="Поделитесь впечатлением (минимум 10 символов)" aria-label="Текст отзыва" />
      <div className="mt-2">
        <div className="text-[11px] c-ink3 font-bold mb-1.5">Прикрепить эмодзи-фото (до 4):</div>
        <div className="flex flex-wrap gap-1.5">
          {EMOJI.map(em => {
            const on = emojis.includes(em);
            return <button key={em} onClick={() => { setEmojis(on ? emojis.filter(x => x !== em) : emojis.length < 4 ? [...emojis, em] : emojis); sfx.click(); }} aria-pressed={on} className={clsx('w-9 h-9 rounded-lg text-lg grid place-items-center border', on ? 'border-[var(--lime)] bg-[rgba(198,255,61,.12)] scale-110' : 'hairline bg-black/20')}>{em}</button>;
          })}
        </div>
      </div>
      {err && <div className="text-xs c-pink font-semibold mt-2">{err}</div>}
      <button onClick={submit} disabled={sending} className="btn-neon w-full rounded-xl py-3 mt-3 flex items-center justify-center gap-2">{sending ? <><Spinner dark />Отправляем…</> : <><Send className="w-4 h-4" />Отправить на модерацию</>}</button>
    </div>
  );
}

export function ProductModal() {
  const id = useUi(s => s.productId), set = useUi(s => s.set);
  const base = useCatalog(s => (id ? s.byId.get(id) : undefined));
  const catName = useCatalog(s => s.data?.categories.find(c => c.id === base?.cat)?.name);
  const rate = useSession(s => s.user?.tier.rate ?? 0.03), user = useSession(s => s.user);
  const qty = useCart(s => (id ? qtyOf(s.lines, id) : 0)), decProduct = useCart(s => s.decProduct);
  const tint = useTint();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<'all' | 'photo' | 'verified' | 'neg'>('all');
  const [sort, setSort] = useState<'new' | 'top' | 'likes'>('new');
  const [liked, setLiked] = useState<number[]>(readLiked);
  const close = () => set({ productId: null });
  const drag = useSheetDrag(close);

  useEffect(() => {
    if (!id) return;
    setDetail(null); setFilter('all');
    api.get<Detail>(`/products/${id}`).then(setDetail).catch(() => setDetail(null));
  }, [id, user?.id]);

  if (!id || !base) return null;
  const p = base;
  const reviews = (detail?.reviews ?? [])
    .filter(r => filter === 'all' || (filter === 'photo' ? r.emojis.length : filter === 'verified' ? r.verified : r.rating <= 3))
    .sort(sort === 'new' ? (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt) : sort === 'top' ? (a, b) => b.rating - a.rating : (a, b) => b.likes - a.likes);
  const rating = detail?.product.rating ?? p.rating;
  const like = (r: Review) => {
    const on = liked.includes(r.id), delta = on ? -1 : 1;
    const next = on ? liked.filter(x => x !== r.id) : [...liked, r.id];
    setLiked(next); try { localStorage.setItem(LIKED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setDetail(d => d && { ...d, reviews: d.reviews.map(x => (x.id === r.id ? { ...x, likes: x.likes + delta } : x)) });
    sfx.pop(); void api.post(`/reviews/${r.id}/like`, { delta }).catch(() => undefined);
  };

  return (
    <Overlay open onClose={close} label={p.name} className="md:max-w-5xl">
      <div data-card>
        <div onPointerDown={drag} style={{ touchAction: 'none' }} className="md:hidden flex justify-center pt-3 pb-1"><span className="sheet-handle" /></div>
        <div className="grid md:grid-cols-[1fr_1.15fr]">
          <div className="p-5 md:p-8 md:border-r hairline">
            <div className="relative">
              <Orb emoji={p.emoji} tint={tint(p.cat)} className="aspect-square w-full max-w-[420px] mx-auto" emoClass="text-[140px] md:text-[180px]" radius={32} />
              <div className="absolute left-3 top-3 flex gap-1.5"><Ribbon badge={p.badge} />{p.old && <span className="ribbon rb-sale">−{discountPct(p)}%</span>}</div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-5 text-center">
              <div className="glass rounded-2xl p-3"><div className="font-mono font-bold c-lime">{p.kcal}</div><div className="text-[10px] c-ink3 font-bold uppercase">ккал / 100 г</div></div>
              <div className="glass rounded-2xl p-3"><div className="font-bold text-sm truncate">{p.country}</div><div className="text-[10px] c-ink3 font-bold uppercase">страна</div></div>
              <div className="glass rounded-2xl p-3"><div className={clsx('font-mono font-bold', p.stock <= 5 ? 'c-yellow' : 'c-cyan')}>{p.stock}</div><div className="text-[10px] c-ink3 font-bold uppercase">на складе</div></div>
            </div>
            <div className="mt-4 rounded-2xl bg-[#f2f4fb] p-3 flex items-center gap-3">
              <Barcode code={p.barcode} h={44} className="w-40 shrink-0" />
              <div className="text-[#10131f] text-xs"><div className="font-bold">EAN-13</div><div className="text-[#5b6180]">Сканируйте на кассе или ищите по коду</div></div>
            </div>
          </div>
          <div className="p-5 md:p-8">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-xs font-bold c-ink3 uppercase tracking-widest">{catName}</div>
                <h2 className="font-display font-bold text-2xl md:text-3xl mt-1.5 leading-tight">{p.name}</h2>
                <div className="flex items-center gap-2 mt-2 text-sm"><Stars value={rating.avg} /><b>{rating.n ? rating.avg.toFixed(1) : '—'}</b><span className="c-ink3">{rating.n} отзывов</span></div>
              </div>
              <CloseBtn onClick={close} className="hidden md:grid !w-10 !h-10" />
            </div>
            <p className="c-ink2 mt-4 leading-relaxed">{p.desc}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">{[...p.tags.map(t => '#' + t), p.unit].map(t => <span key={t} className="chip rounded-full px-2.5 py-1 text-[11px] font-bold">{t}</span>)}</div>
            <div className="mt-5 rounded-3xl glass p-4 flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[140px]">
                <div className="flex items-baseline gap-2"><span className="font-display font-bold text-3xl">{money(p.price)}</span>{p.old && <span className="line-through c-ink3">{money(p.old)}</span>}</div>
                <div className="text-xs font-bold c-lime mt-1 flex items-center gap-1"><Coins className="w-3.5 h-3.5" />+{Math.max(1, Math.floor(p.price * rate))} бонусов вернётся на счёт ({Math.round(rate * 100)}%)</div>
              </div>
              <div className="flex items-center gap-2">
                {qty > 0 && <div className="flex items-center gap-1 rounded-xl bg-black/30 p-1"><button onClick={() => { decProduct(p.id); sfx.click(); }} className="w-10 h-10 rounded-lg grid place-items-center hover:bg-white/10" aria-label="Меньше"><Minus className="w-4 h-4" /></button><span className="w-8 text-center font-mono font-bold c-lime">{qty}</span></div>}
                <button onClick={e => addToCart(p, e.currentTarget.closest('[data-card]')?.querySelector('.orb'))} disabled={p.stock <= 0} className="btn-neon rounded-xl px-5 h-12 flex items-center gap-2"><ShoppingCart className="w-5 h-5" strokeWidth={2.4} />{qty ? 'Ещё' : 'В корзину'}</button>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="font-display font-bold text-lg flex items-center gap-2"><MessageSquareHeart className="w-5 h-5 c-pink" />Отзывы</h3>
              <div className="mt-4 grid grid-cols-[auto_1fr] gap-5 items-center">
                <div className="text-center"><div className="font-display font-black text-5xl">{rating.n ? rating.avg.toFixed(1) : '—'}</div><div className="mt-1"><Stars value={rating.avg} size="w-3 h-3" /></div></div>
                <div className="space-y-1">
                  {[5, 4, 3, 2, 1].map(s => {
                    const n = detail?.dist[s - 1] ?? 0;
                    return <div key={s} className="flex items-center gap-2 text-xs"><span className="w-3 c-ink3 font-mono">{s}</span><div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-[var(--yellow)] tr" style={{ width: `${rating.n ? n / rating.n * 100 : 0}%` }} /></div><span className="w-5 text-right c-ink3 font-mono">{n}</span></div>;
                  })}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-5">
                {([['all', 'Все'], ['photo', '📸 С фото'], ['verified', '✓ Проверенные'], ['neg', 'Критика']] as const).map(([k, l]) => <button key={k} onClick={() => { setFilter(k); sfx.click(); }} className={clsx('chip rounded-full px-3 py-1.5 text-xs font-bold', filter === k && 'on')}>{l}</button>)}
                <select value={sort} onChange={e => setSort(e.target.value as typeof sort)} className="field !w-auto !py-1.5 !rounded-full text-xs ml-auto" aria-label="Сортировка отзывов"><option value="new">Новые</option><option value="top">Высокая оценка</option><option value="likes">Полезные</option></select>
              </div>
              <div className="mt-4 space-y-3">
                {!detail && [0, 1].map(i => <div key={i} className="rounded-2xl p-4 bg-black/20"><div className="flex gap-3"><div className="skel w-9 h-9 !rounded-full" /><div className="flex-1"><div className="skel h-3 w-1/3" /><div className="skel h-3 w-1/4 mt-2" /></div></div><div className="skel h-3 w-full mt-4" /></div>)}
                {reviews.map(r => (
                  <div key={r.id} className={clsx('rounded-2xl p-4 border hairline', r.status === 'pending' ? 'bg-[rgba(252,238,10,.05)] !border-[rgba(252,238,10,.3)]' : 'bg-black/20')}>
                    <div className="flex items-center gap-2.5">
                      <span className="w-9 h-9 rounded-full grid place-items-center font-bold text-sm" style={{ background: 'linear-gradient(135deg,#22306a,#111a3a)' }}>{r.author.slice(0, 1)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold flex items-center gap-1.5 flex-wrap">{r.author}
                          {r.verified && <span className="text-[10px] c-lime font-bold flex items-center gap-0.5"><BadgeCheck className="w-3 h-3" />покупатель</span>}
                          {r.status === 'pending' && <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-[var(--yellow)] text-black">⏳ Ожидает проверки</span>}
                        </div>
                        <div className="flex items-center gap-2"><Stars value={r.rating} size="w-3 h-3" /><span className="text-[11px] c-ink3">{timeAgo(r.createdAt)}</span></div>
                      </div>
                    </div>
                    <p className="text-sm c-ink2 mt-2.5 leading-relaxed">{r.text}</p>
                    {r.emojis.length > 0 && <div className="flex gap-2 mt-2.5">{r.emojis.map((em, k) => <span key={k} className="w-12 h-12 rounded-xl grid place-items-center text-2xl border hairline" style={{ background: 'linear-gradient(135deg,#1a2350,#0b1230)' }}>{em}</span>)}</div>}
                    {r.status === 'approved' && <button onClick={() => like(r)} className={clsx('mt-2.5 text-xs font-bold flex items-center gap-1.5', liked.includes(r.id) ? 'c-lime' : 'c-ink3 hover:text-white')}><ThumbsUp className="w-3.5 h-3.5" />Полезно · {r.likes}</button>}
                  </div>
                ))}
                {detail && !reviews.length && <div className="text-center c-ink3 text-sm py-6">Пока нет отзывов с таким фильтром</div>}
              </div>
              <ReviewForm productId={p.id} onSent={r => setDetail(d => d && { ...d, reviews: [r, ...d.reviews] })} />
            </div>
          </div>
        </div>
      </div>
    </Overlay>
  );
}
