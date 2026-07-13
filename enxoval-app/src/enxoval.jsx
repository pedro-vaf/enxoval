import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const INITIAL_ROOMS = [
  {
    id: "lavanderia",
    label: "Lavanderia",
    items: [
      "Balde retrátil", "Bacia retrátil", "Pregadores de roupa", "Flanelas",
      "Escovas de limpeza", "Varal dobrável", "Cesto de roupa", "Borrifador",
      "Porta amaciante/sabão líquido", "Porta sabão em pó",
      "Kit limpeza vassoura/rodo/pá", "Escova de roupa", "Panos de chão",
      "Lixeira", "Torneira", "Suporte para vassoura", "Armário multiuso",
      "Esfregão", "Cesto para pregadores de roupa",
      "Sacos para lavar roupa íntima", "Porta vanish/desinfetante",
      "Espanador", "Luvas", "Mop", "Varal", "Escada",
    ],
  },
  {
    id: "banheiro",
    label: "Banheiro",
    items: [
      "Torneira", "Armário de pia", "Espelho", "Chuveiro", "Box",
      "Cesto de roupa", "Difusor de ambiente", "Escova sanitária",
      "Decoração", "Frasco condicionador/shampoo", "Porta papel higiênico",
      "Toalhas de banho", "Frasco sabão líquido", "Porta toalha de banho/rosto",
      "Dispenser de detergente", "Toalhas de rosto", "Saboneteira automática",
      "Porta cotonete/algodão", "Rodo", "Porta escova de dente", "Tapetes",
      "Nicho", "Lixeira", "Porta sabonete", "Tampa da privada",
    ],
  },
  {
    id: "cozinha",
    label: "Cozinha",
    items: [
      "Jogo de pratos", "Jogo de copos", "Jogo de taças", "Jogo de talheres",
      "Jogo de xícaras", "Jogo de panelas", "Jogo de facas", "Panela de pressão",
      "Cuscuzeira", "Cafeteira", "Panos de prato", "Tapete", "Travessa",
      "Potes plásticos", "Potes organizadores", "Porta tempero",
      "Colheres (feijão, arroz, macarrão, salada)", "Escorredor de pratos",
      "Peneiras", "Jarra de vidro", "Jarra de plástico",
      "Escorredor de macarrão/arroz", "Flanelas", "Lixeiras", "Sacos de lixo",
      "Kit para pia (porta detergente, esponja)", "Toalhas de mão",
      "Garrafa de café", "Garrafas de água", "Abridores de lata/garrafa",
      "Espremedor de alho", "Açucareiro", "Saleiro", "Conjunto de sobremesas",
      "Colher de pau", "Medidores", "Espátula de bolo", "Forma de bolo",
      "Forma de gelo", "Jogo americano", "Ralador", "Paliteiro",
      "Petisqueira", "Boleira", "Tábua de corte", "Saca-rolhas",
    ],
  },
  {
    id: "sala",
    label: "Sala",
    items: [
      "Sofá", "Televisão", "Alexa", "Painel para TV", "Tapete felpudo",
      "Cortina", "Almofadas", "Capas para almofadas", "Varal para cortina",
      "Suporte para copo", "Manta para sofá", "Decoração", "Quadro",
    ],
  },
  {
    id: "outros",
    label: "Outros",
    items: [
      "Ferramentas", "Kit costura", "Aparelho de pressão", "Nebulizador",
      "Termômetro", "Extensão", "Furadeira", "Benjamin", "Parafusadeira",
      "Chaves de fenda",
    ],
  },
];

const STORAGE_KEY = "enxoval-dinamico-v2";

const slugify = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const createItem = (name) => ({
  id: `${slugify(name) || "item"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  bought: false,
  price: "",
});

const createInitialRooms = () =>
  INITIAL_ROOMS.map((room, roomIndex) => ({
    id: room.id,
    label: room.label,
    glyph: String(roomIndex + 1).padStart(2, "0"),
    items: room.items.map((name, itemIndex) => ({
      id: `${room.id}-${itemIndex}`,
      name,
      bought: false,
      price: "",
    })),
  }));

const currency = (value) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const parsePrice = (value) => {
  if (!value) return 0;
  const parsed = Number.parseFloat(value.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(parsed) ? 0 : parsed;
};

async function storageGet(key) {
  if (window.storage?.get) {
    const result = await window.storage.get(key, false);
    return result?.value || null;
  }
  return window.localStorage.getItem(key);
}

async function storageSet(key, value) {
  if (window.storage?.set) {
    await window.storage.set(key, value, false);
    return;
  }
  window.localStorage.setItem(key, value);
}

function CheckButton({ checked, onToggle }) {
  return (
    <button
      type="button"
      className={`peg ${checked ? "peg--on" : ""}`}
      onClick={onToggle}
      aria-pressed={checked}
      aria-label={checked ? "Marcado como comprado" : "Marcar como comprado"}
    >
      <span className="peg__body">
        <svg viewBox="0 0 20 12" className="peg__check" aria-hidden="true">
          <polyline points="2,6 8,11 18,1" />
        </svg>
      </span>
    </button>
  );
}

export default function EnxovalApp() {
  const [rooms, setRooms] = useState(createInitialRooms);
  const [activeRoomId, setActiveRoomId] = useState("lavanderia");
  const [newRoomName, setNewRoomName] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await storageGet(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed.rooms) && parsed.rooms.length) {
            setRooms(parsed.rooms);
            setActiveRoomId(parsed.activeRoomId || parsed.rooms[0].id);
          }
        }
      } catch (error) {
        console.error("Não foi possível carregar os dados salvos.", error);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(async () => {
      try {
        await storageSet(STORAGE_KEY, JSON.stringify({ rooms, activeRoomId }));
        setSavedPulse(true);
        setTimeout(() => setSavedPulse(false), 900);
      } catch (error) {
        console.error("Falha ao salvar.", error);
      }
    }, 500);

    return () => clearTimeout(saveTimer.current);
  }, [rooms, activeRoomId, loaded]);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) || rooms[0];

  useEffect(() => {
    if (!rooms.some((room) => room.id === activeRoomId) && rooms[0]) {
      setActiveRoomId(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  const roomStats = useCallback((room) => {
    const total = room.items.length;
    const bought = room.items.filter((item) => item.bought).length;
    const spent = room.items.reduce((sum, item) => sum + parsePrice(item.price), 0);
    return { total, bought, spent };
  }, []);

  const overall = useMemo(
    () =>
      rooms.reduce(
        (acc, room) => {
          const stats = roomStats(room);
          acc.total += stats.total;
          acc.bought += stats.bought;
          acc.spent += stats.spent;
          return acc;
        },
        { total: 0, bought: 0, spent: 0 }
      ),
    [rooms, roomStats]
  );

  const updateItem = (roomId, itemId, patch) => {
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? {
              ...room,
              items: room.items.map((item) =>
                item.id === itemId ? { ...item, ...patch } : item
              ),
            }
          : room
      )
    );
  };

  const addRoom = (event) => {
    event.preventDefault();
    const label = newRoomName.trim();
    if (!label) return;

    const baseId = slugify(label) || "comodo";
    const id = rooms.some((room) => room.id === baseId)
      ? `${baseId}-${Date.now()}`
      : baseId;

    const newRoom = {
      id,
      label,
      glyph: String(rooms.length + 1).padStart(2, "0"),
      items: [],
    };

    setRooms((current) => [...current, newRoom]);
    setActiveRoomId(id);
    setNewRoomName("");
  };

  const addItem = (event) => {
    event.preventDefault();
    const name = newItemName.trim();
    if (!name || !activeRoom) return;

    setRooms((current) =>
      current.map((room) =>
        room.id === activeRoom.id
          ? { ...room, items: [...room.items, createItem(name)] }
          : room
      )
    );
    setNewItemName("");
  };

  const removeItem = (roomId, itemId) => {
    setRooms((current) =>
      current.map((room) =>
        room.id === roomId
          ? { ...room, items: room.items.filter((item) => item.id !== itemId) }
          : room
      )
    );
  };

  const removeRoom = () => {
    if (!activeRoom || rooms.length === 1) return;
    setRooms((current) => current.filter((room) => room.id !== activeRoom.id));
  };

  const resetAll = () => {
    const initial = createInitialRooms();
    setRooms(initial);
    setActiveRoomId(initial[0].id);
  };

  if (!activeRoom) return null;

  const stats = roomStats(activeRoom);
  const percent = stats.total ? Math.round((stats.bought / stats.total) * 100) : 0;

  return (
    <div className="app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        :root{--navy-950:#071620;--navy-900:#0a1f2c;--card:#122636;--card-hover:#163046;--line:rgba(198,224,222,.10);--teal-500:#2fb6a3;--teal-400:#4fd6c0;--teal-300:#8fe9d8;--brass:#d3a75c;--ink:#eaf3f1;--ink-dim:#93aeae;--ink-faint:#5f7c7c;}
        *{box-sizing:border-box}.app{min-height:100vh;background:radial-gradient(ellipse 900px 500px at 15% -10%,rgba(47,182,163,.12),transparent 60%),radial-gradient(ellipse 700px 500px at 100% 0%,rgba(211,167,92,.06),transparent 55%),var(--navy-950);color:var(--ink);font-family:Inter,system-ui,sans-serif;display:flex;flex-direction:column}.header{padding:36px 28px 20px;position:relative;border-bottom:1px solid var(--line)}.header__line{position:absolute;top:22px;left:28px;right:28px;height:1px;background:linear-gradient(90deg,var(--teal-500),transparent 70%);opacity:.35}.eyebrow{font-family:'JetBrains Mono',monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--teal-300);margin:0 0 6px}h1{font-family:Fraunces,serif;font-weight:500;font-size:clamp(28px,5vw,42px);margin:0}h1 em{font-style:italic;color:var(--teal-300)}.header__meta{display:flex;gap:28px;margin-top:18px;flex-wrap:wrap}.meta-stat{display:flex;flex-direction:column;gap:2px}.num{font-family:Fraunces,serif;font-size:22px}.num.brass{color:var(--brass)}.lbl{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink-faint)}.save-indicator{position:absolute;top:36px;right:28px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--teal-400);opacity:0;transition:opacity .3s;display:flex;align-items:center;gap:6px}.save-indicator.show{opacity:.85}.dot{width:5px;height:5px;border-radius:50%;background:var(--teal-400)}.layout{display:flex;flex:1;min-height:0}.rooms-rail{width:230px;flex-shrink:0;padding:24px 12px;border-right:1px solid var(--line)}.room-tab{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:none;border:none;color:var(--ink-dim);font:500 14px Inter;padding:11px 10px 11px 16px;cursor:pointer;border-radius:8px;transition:.2s}.room-tab:hover{color:var(--ink);background:rgba(255,255,255,.03)}.room-tab.active{color:var(--teal-300);background:rgba(47,182,163,.08)}.glyph{font-family:'JetBrains Mono',monospace;font-size:10.5px;color:var(--teal-400)}.room-tab__progress{margin-left:auto;font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--ink-faint)}.add-room{margin-top:18px;padding-top:18px;border-top:1px solid var(--line)}.main{flex:1;padding:28px 32px 60px;overflow-y:auto}.room-head{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:18px;flex-wrap:wrap}.room-head h2{font-family:Fraunces,serif;font-weight:500;font-size:26px;margin:0}.progress-wrap{display:flex;align-items:center;gap:12px;min-width:220px}.progress-bar{flex:1;height:5px;border-radius:4px;background:rgba(255,255,255,.06);overflow:hidden}.progress-fill{height:100%;background:linear-gradient(90deg,var(--teal-500),var(--teal-300));transition:width .4s}.progress-pct{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--teal-300);width:34px;text-align:right}.room-spent{font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--brass)}.toolbar{display:flex;gap:10px;margin-bottom:18px;flex-wrap:wrap}.form-inline{display:flex;gap:8px;flex:1;min-width:280px}.text-input{width:100%;background:var(--card);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:10px 12px;outline:none}.text-input:focus{border-color:rgba(79,214,192,.5)}.btn{border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--ink);padding:9px 13px;font-weight:600;cursor:pointer}.btn:hover{background:var(--card-hover)}.btn-primary{background:var(--teal-500);border-color:var(--teal-500);color:var(--navy-950)}.btn-danger{color:#ffb4b4}.items-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px}.item-row{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:11px 14px;transition:.2s}.item-row:hover{background:var(--card-hover)}.item-row.done{border-color:rgba(47,182,163,.28);background:rgba(47,182,163,.05)}.item-name{flex:1;font-size:14px;line-height:1.35}.item-row.done .item-name{color:var(--ink-faint);text-decoration:line-through;text-decoration-color:var(--teal-500)}.price-field{display:flex;align-items:center;gap:4px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:6px;padding:5px 8px}.price-field span{font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--ink-faint)}.price-field input{width:64px;background:none;border:none;outline:none;color:var(--brass);font-family:'JetBrains Mono',monospace;font-size:12.5px}.icon-btn{border:none;background:none;color:var(--ink-faint);cursor:pointer;font-size:18px;line-height:1;padding:2px}.icon-btn:hover{color:#ffb4b4}.peg{appearance:none;border:none;background:none;cursor:pointer;width:26px;height:26px;padding:0;flex-shrink:0}.peg__body{width:22px;height:22px;border-radius:6px;border:1.5px solid var(--ink-faint);display:flex;align-items:center;justify-content:center;transition:.2s;background:rgba(255,255,255,.02)}.peg__check{width:12px;height:8px;fill:none;stroke:var(--navy-950);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;opacity:0;transform:scale(.6);transition:.18s}.peg--on .peg__body{background:var(--teal-400);border-color:var(--teal-400)}.peg--on .peg__check{opacity:1;transform:scale(1)}.empty{padding:36px;border:1px dashed var(--line);border-radius:12px;text-align:center;color:var(--ink-faint)}.footer-note{margin-top:34px;padding-top:18px;border-top:1px solid var(--line);font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--ink-faint)}@media(max-width:760px){.layout{flex-direction:column}.rooms-rail{width:100%;border-right:none;border-bottom:1px solid var(--line);display:flex;overflow-x:auto;padding:14px 16px;gap:4px}.room-tab{white-space:nowrap;min-width:max-content}.add-room{min-width:280px;margin:0 0 0 12px;padding:0 0 0 12px;border-top:none;border-left:1px solid var(--line)}.main{padding:22px 18px 50px}.items-grid{grid-template-columns:1fr}}
      `}</style>

      <header className="header">
        <div className="header__line" />
        <p className="eyebrow">Lista de Enxoval</p>
        <h1>Meu <em>enxoval</em>, item por item</h1>
        <div className={`save-indicator ${savedPulse ? "show" : ""}`}>
          <span className="dot" /> salvo
        </div>
        <div className="header__meta">
          <div className="meta-stat"><span className="num">{overall.bought}/{overall.total}</span><span className="lbl">itens comprados</span></div>
          <div className="meta-stat"><span className="num">{overall.total ? Math.round((overall.bought / overall.total) * 100) : 0}%</span><span className="lbl">concluído</span></div>
          <div className="meta-stat"><span className="num brass">{currency(overall.spent)}</span><span className="lbl">investido até agora</span></div>
        </div>
      </header>

      <div className="layout">
        <nav className="rooms-rail">
          {rooms.map((room) => {
            const roomInfo = roomStats(room);
            return (
              <button key={room.id} className={`room-tab ${room.id === activeRoom.id ? "active" : ""}`} onClick={() => setActiveRoomId(room.id)}>
                <span className="glyph">{room.glyph}</span>
                {room.label}
                <span className="room-tab__progress">{roomInfo.bought}/{roomInfo.total}</span>
              </button>
            );
          })}
          <form className="add-room" onSubmit={addRoom}>
            <input className="text-input" value={newRoomName} onChange={(event) => setNewRoomName(event.target.value)} placeholder="Novo cômodo" aria-label="Nome do novo cômodo" />
            <button className="btn btn-primary" type="submit" style={{ width: "100%", marginTop: 8 }}>+ Adicionar cômodo</button>
          </form>
        </nav>

        <main className="main">
          <div className="room-head">
            <h2><span className="glyph">{activeRoom.glyph}</span> {activeRoom.label}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div className="progress-wrap"><div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div><span className="progress-pct">{percent}%</span></div>
              <span className="room-spent">{currency(stats.spent)}</span>
            </div>
          </div>

          <div className="toolbar">
            <form className="form-inline" onSubmit={addItem}>
              <input className="text-input" value={newItemName} onChange={(event) => setNewItemName(event.target.value)} placeholder={`Novo utensílio para ${activeRoom.label}`} aria-label="Nome do novo utensílio" />
              <button className="btn btn-primary" type="submit">+ Adicionar utensílio</button>
            </form>
            {rooms.length > 1 && <button className="btn btn-danger" type="button" onClick={removeRoom}>Excluir cômodo</button>}
            <button className="btn" type="button" onClick={resetAll}>Restaurar lista inicial</button>
          </div>

          {activeRoom.items.length ? (
            <div className="items-grid">
              {activeRoom.items.map((item) => (
                <div className={`item-row ${item.bought ? "done" : ""}`} key={item.id}>
                  <CheckButton checked={item.bought} onToggle={() => updateItem(activeRoom.id, item.id, { bought: !item.bought })} />
                  <span className="item-name">{item.name}</span>
                  <label className="price-field"><span>R$</span><input type="text" inputMode="decimal" placeholder="0,00" value={item.price} onChange={(event) => updateItem(activeRoom.id, item.id, { price: event.target.value.replace(/[^0-9,]/g, "") })} /></label>
                  <button className="icon-btn" type="button" onClick={() => removeItem(activeRoom.id, item.id)} aria-label={`Excluir ${item.name}`} title="Excluir utensílio">×</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">Este cômodo ainda não possui utensílios. Use o campo acima para adicionar o primeiro item.</div>
          )}

          <p className="footer-note">{activeRoom.label.toLowerCase()} · {stats.total} itens catalogados · dados salvos automaticamente neste dispositivo</p>
        </main>
      </div>
    </div>
  );
}
