/* ============================================
   Achou Trocador — MVP
   Armazenamento: Supabase (dados compartilhados entre todo mundo
   que abre o app). Ver README.md para configurar seu projeto.
   ============================================ */

// -------- Supabase --------
// Preencha com os valores de Project Settings → API do seu projeto.
const SUPABASE_URL = 'https://ndesisxkoqyunjzbreyr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5kZXNpc3hrb3F5dW5qemJyZXlyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NDI3NjYsImV4cCI6MjEwNDExODc2Nn0.UGeD8y09m3mDWEeVp1UNAKwks_KPrAUXaFTsXTMK8w4';
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function locationLabel(key){
  return t(`location.${key}`);
}

// -------- Dados de exemplo (Buenos Aires) --------
// Servem só pra você ver o app funcionando de cara.
// Apague ou edite livremente pela própria interface.
const SEED_SPOTS = [
  {
    id: 'seed-1',
    name: 'Alto Palermo Shopping — praça de alimentação',
    lat: -34.5885, lng: -58.4106,
    location: 'familia',
    notes: 'Banheiro família no 2º piso, perto do patio de comidas.',
    createdAt: Date.now(),
  },
  {
    id: 'seed-2',
    name: 'Parque Las Heras',
    lat: -34.5836, lng: -58.4114,
    location: 'ambos',
    notes: 'Trocador nos dois banheiros públicos do parque.',
    createdAt: Date.now(),
  },
];

// ---------------- Estado ----------------
let spots = [];
let userLatLng = null;
let browsingLocation = null; // { lat, lng, label } — "ver perto de" um lugar buscado, não da localização real
let map, userMarker;
let markers = new Map();
let pendingLatLng = null; // ponto escolhido no formulário (novo local)
let editingId = null;
let ratingsSummary = new Map(); // spotId -> { avg, count }
let approvedPhotos = new Map(); // spotId -> [{ url }]

// -------- Identidade anônima por dispositivo --------
// Sem login: favoritos ficam só no aparelho; o device id evita
// que o mesmo aparelho vote mais de uma vez no mesmo local.
function getDeviceId(){
  let id = localStorage.getItem('achou-trocador:device-id');
  if(!id){
    id = crypto.randomUUID ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('achou-trocador:device-id', id);
  }
  return id;
}
const deviceId = getDeviceId();

const FAVORITES_KEY = 'achou-trocador:favorites:v1';
function loadFavorites(){
  try{
    const raw = JSON.parse(localStorage.getItem(FAVORITES_KEY));
    return new Set(Array.isArray(raw) ? raw : []);
  }catch(e){
    return new Set();
  }
}
let favorites = loadFavorites();
function saveFavorites(){
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
}
function toggleFavorite(id){
  if(favorites.has(id)) favorites.delete(id); else favorites.add(id);
  saveFavorites();
  const spot = spots.find(s => s.id === id);
  // adia pro próximo tick: trocar o conteúdo do popup ainda DENTRO do clique
  // que originou a chamada confunde o Leaflet (ele acha que foi clique fora
  // do popup e fecha ele). rateSpot/confirmField não têm esse problema
  // porque já são async e só trocam o conteúdo depois do clique terminar.
  setTimeout(() => { if(spot) refreshSpotUI(spot); else renderList(); }, 0);
}

// ---------------- Storage (Supabase) ----------------
function rowToSpot(row){
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    location: row.location,
    notes: row.notes || '',
    dadAllowed: row.dad_allowed,
    accessType: row.access_type,
    stillOpen: row.still_open,
    hasChangingTable: row.has_changing_table,
    locationConfirmed: row.location_confirmed,
    dadAllowedConfirmed: row.dad_allowed_confirmed,
    accessTypeConfirmed: row.access_type_confirmed,
    hasChangingTableConfirmed: row.has_changing_table_confirmed,
    lastConfirmedAt: row.last_confirmed_at ? new Date(row.last_confirmed_at).getTime() : null,
    verified: row.verified,
    createdAt: new Date(row.created_at).getTime(),
  };
}

async function loadSpots(){
  const { data, error } = await sb
    .from('spots')
    .select('*')
    .order('created_at', { ascending: true });
  if(error){
    console.error('Erro ao carregar locais do Supabase:', error);
    showToast(t('toast.loadError'));
    return [...SEED_SPOTS];
  }
  return data.map(rowToSpot);
}

async function saveSpot(spot){
  // insert puro, não upsert: hoje todo local salvo é sempre novo (não existe
  // edição de local já existente na interface). Isso importa porque upsert
  // vira "insert ... on conflict do update" no Postgres, e isso exige
  // permissão de update em TODAS as colunas do comando mesmo quando o
  // conflito nunca acontece — e a permissão de update do anon é
  // propositalmente restrita só às colunas de confirmação (Passos 3/4/6/7).
  const { error } = await sb.from('spots').insert({
    id: spot.id,
    name: spot.name,
    lat: spot.lat,
    lng: spot.lng,
    location: spot.location,
    notes: spot.notes,
    dad_allowed: spot.dadAllowed,
    access_type: spot.accessType,
    still_open: true,
    // quem cadastra já escolheu esses valores de próprio punho — trava na
    // hora só o que foi realmente preenchido; o que ficou em branco continua
    // aberto pra comunidade confirmar (e travar) depois.
    location_confirmed: true,
    dad_allowed_confirmed: spot.dadAllowed !== null,
    access_type_confirmed: spot.accessType !== null,
    // quem cadastra pelo formulário sabe que tem trocador (é por isso que
    // está cadastrando) — então já nasce confirmado como "tem".
    has_changing_table: true,
    has_changing_table_confirmed: true,
    last_confirmed_at: new Date().toISOString(),
    verified: true,
  });
  if(error){
    console.error('Erro ao salvar local no Supabase:', error);
    showToast(t('toast.saveError'));
    return false;
  }
  return true;
}

// -------- Confirmação de informações --------
// Só mexe nas colunas liberadas pro anon (dad_allowed, access_type,
// still_open, location, last_confirmed_at, verified) — nunca no nome/notas.
// Campos "estruturais" travam depois da primeira confirmação — uma vez que
// alguém confirmou, fica valendo pra sempre (evita gente ficando de brincar
// de trocar o mesmo campo pra lá e pra cá). "still_open" fica de fora de
// propósito: um lugar pode fechar e reabrir de verdade com o tempo.
const LOCK_COLUMN = {
  location: 'location_confirmed',
  dad_allowed: 'dad_allowed_confirmed',
  access_type: 'access_type_confirmed',
  has_changing_table: 'has_changing_table_confirmed',
};
const LOCK_FIELD_CAMEL = {
  location_confirmed: 'locationConfirmed',
  dad_allowed_confirmed: 'dadAllowedConfirmed',
  access_type_confirmed: 'accessTypeConfirmed',
  has_changing_table_confirmed: 'hasChangingTableConfirmed',
};

async function confirmField(spotId, field, value){
  const update = { [field]: value, last_confirmed_at: new Date().toISOString(), verified: true };
  const lockColumn = LOCK_COLUMN[field];
  if(lockColumn) update[lockColumn] = true;
  const { error } = await sb.from('spots').update(update).eq('id', spotId);
  if(error){
    console.error('Erro ao confirmar informação:', error);
    showToast(t('toast.confirmError'));
    return;
  }
  const spot = spots.find(s => s.id === spotId);
  if(spot){
    const camelField = { dad_allowed: 'dadAllowed', access_type: 'accessType', still_open: 'stillOpen', location: 'location', has_changing_table: 'hasChangingTable' }[field];
    spot[camelField] = value;
    spot.lastConfirmedAt = Date.now();
    spot.verified = true;
    if(lockColumn) spot[LOCK_FIELD_CAMEL[lockColumn]] = true;
    refreshSpotUI(spot);
  }
  showToast(t('toast.confirmThanks'));
}

// Atualiza só o marcador/popup deste local, sem reconstruir o mapa inteiro
// (isso fechava o popup toda vez que alguém confirmava algo).
function refreshSpotUI(spot){
  const marker = markers.get(spot.id);
  if(marker){
    marker.setIcon(pinIcon(spotPinClass(spot), spotPinGlyph(spot)));
    marker.setPopupContent(popupHtml(spot));
  }
  renderList();
}

function verifiedBadge(spot){
  if(!spot.verified) return '';
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="#3B82F6" style="flex-shrink:0" aria-label="${t('verified.label')}"><title>${t('verified.label')}</title><path d="M12 2l2.24 1.86 2.87-.47 1.12 2.7 2.7 1.12-.47 2.87L22 12l-1.54 2.24.47 2.87-2.7 1.12-1.12 2.7-2.87-.47L12 22l-2.24-1.54-2.87.47-1.12-2.7-2.7-1.12.47-2.87L2 12l1.54-2.24-.47-2.87 2.7-1.12 1.12-2.7 2.87.47z"/><path d="M8.5 12.3l2.3 2.3 4.7-4.9" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function pluralKey(base, n){
  return n === 1 ? `${base}One` : `${base}Other`;
}

function formatRelativeTime(ts){
  if(!ts) return t('confirm.never');
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if(minutes < 1) return t('time.justNow');
  if(minutes < 60) return t(pluralKey('time.minutesAgo', minutes), { n: minutes });
  const hours = Math.floor(minutes / 60);
  if(hours < 24) return t(pluralKey('time.hoursAgo', hours), { n: hours });
  const days = Math.floor(hours / 24);
  if(days < 30) return t(pluralKey('time.daysAgo', days), { n: days });
  const months = Math.floor(days / 30);
  if(months < 12) return t(pluralKey('time.monthsAgo', months), { n: months });
  const years = Math.floor(months / 12);
  return t(pluralKey('time.yearsAgo', years), { n: years });
}

// -------- Avaliações --------
async function loadRatingsSummary(){
  const { data, error } = await sb.from('spot_ratings_summary').select('*');
  if(error){
    console.error('Erro ao carregar avaliações:', error);
    return;
  }
  ratingsSummary = new Map(data.map(r => [r.spot_id, { avg: Number(r.avg_rating), count: r.ratings_count }]));
}

async function rateSpot(spotId, rating){
  const { error } = await sb.from('spot_ratings').upsert(
    { spot_id: spotId, device_id: deviceId, rating },
    { onConflict: 'spot_id,device_id' }
  );
  if(error){
    console.error('Erro ao avaliar:', error);
    showToast(t('toast.rateError'));
    return;
  }
  await loadRatingsSummary();
  const spot = spots.find(s => s.id === spotId);
  if(spot) refreshSpotUI(spot); else renderList();
  showToast(t('toast.rateThanks'));
}

// -------- Fotos --------
async function loadApprovedPhotos(){
  const { data, error } = await sb.from('spot_photos').select('spot_id, storage_path').eq('status', 'approved');
  if(error){
    console.error('Erro ao carregar fotos:', error);
    return;
  }
  approvedPhotos = new Map();
  for(const row of data){
    const { data: pub } = sb.storage.from('spot-photos').getPublicUrl(row.storage_path);
    const arr = approvedPhotos.get(row.spot_id) || [];
    arr.push({ url: pub.publicUrl });
    approvedPhotos.set(row.spot_id, arr);
  }
}

async function handlePhotoInput(e, spotId){
  const file = e.target.files[0];
  e.target.value = '';
  if(!file) return;
  if(!file.type.startsWith('image/')){
    showToast(t('toast.photoNotImage'));
    return;
  }
  if(file.size > 5 * 1024 * 1024){
    showToast(t('toast.photoTooBig'));
    return;
  }
  showToast(t('toast.photoUploading'));
  const path = `${spotId}/${Date.now()}-${file.name}`.replace(/\s+/g, '-');
  const { error: upErr } = await sb.storage.from('spot-photos').upload(path, file);
  if(upErr){
    console.error('Erro ao subir foto:', upErr);
    showToast(t('toast.photoUploadError'));
    return;
  }
  const { error: insErr } = await sb.from('spot_photos').insert({
    spot_id: spotId,
    storage_path: path,
    device_id: deviceId,
  });
  if(insErr){
    console.error('Erro ao registrar foto:', insErr);
    showToast(t('toast.photoRegisterError'));
    return;
  }
  showToast(t('toast.photoSent'));
}

function subscribeToNewSpots(){
  sb
    .channel('public:spots')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'spots' }, (payload) => {
      const spot = rowToSpot(payload.new);
      if(spots.some(s => s.id === spot.id)) return;
      spots.push(spot);
      renderAllMarkers();
      renderList();
    })
    .subscribe();
}

// Pra distância/"mais perto": usa o lugar buscado (se houver), senão a
// localização real do GPS. Cadastrar um local novo sempre usa o GPS de
// verdade (browsingLocation não entra nisso).
function referencePoint(){
  return browsingLocation || userLatLng;
}

// ---------------- Distância (haversine, em metros) ----------------
function distanceMeters(a, b){
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI/180;
  const dLng = (b.lng - a.lng) * Math.PI/180;
  const lat1 = a.lat * Math.PI/180, lat2 = b.lat * Math.PI/180;
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function formatDistance(m){
  if(m < 1000) return `${Math.round(m/10)*10} m`;
  return `${(m/1000).toFixed(1)} km`;
}

// ---------------- Mapa ----------------
function initMap(){
  map = L.map('map', { zoomControl: false, attributionControl: true })
    .setView([-34.6037, -58.3816], 13); // fallback: CABA

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  map.on('click', (e) => {
    if(formPanel.getAttribute('aria-hidden') === 'false'){
      setPendingLocation(e.latlng.lat, e.latlng.lng);
    }
  });

  // popup ficou mais alto (avaliação, fotos, confirmações) e passou a
  // sobrepor o botão + em alguns casos — some ele enquanto tiver popup aberto
  map.on('popupopen', () => appEl.classList.add('popup-open'));
  map.on('popupclose', () => appEl.classList.remove('popup-open'));

  renderAllMarkers();
  locateUser();
}

function pinIcon(className, glyph){
  return L.divIcon({
    className: '',
    html: `<div class="pin ${className}">${glyph}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 32],
  });
}

const dropGlyph = `<svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="6"/></svg>`;
const noTableGlyph = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>`;
const meGlyph = `<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="7"/></svg>`;

function spotPinClass(spot){
  return spot.hasChangingTable === false ? 'no-table' : `loc-${spot.location}`;
}
function spotPinGlyph(spot){
  return spot.hasChangingTable === false ? noTableGlyph : dropGlyph;
}

function renderAllMarkers(){
  markers.forEach(m => map.removeLayer(m));
  markers.clear();
  spots.forEach(spot => {
    const icon = pinIcon(spotPinClass(spot), spotPinGlyph(spot));
    const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map);
    marker.bindPopup(popupHtml(spot));
    markers.set(spot.id, marker);
  });
}

function heartSvg(filled){
  return `<svg width="18" height="18" viewBox="0 0 24 24" fill="${filled ? '#FF6B5C' : 'none'}" stroke="${filled ? '#FF6B5C' : '#CBD5E1'}" stroke-width="1.8"><path d="M12 21s-7.5-4.6-10-9.3C.5 8 2.6 4.5 6.2 4.2c2-.2 3.8.9 5.8 3 2-2.1 3.8-3.2 5.8-3 3.6.3 5.7 3.8 4.2 7.5C19.5 16.4 12 21 12 21z"/></svg>`;
}
function starSvg(filled){
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="${filled ? '#FFC857' : 'none'}" stroke="${filled ? '#FFC857' : '#CBD5E1'}" stroke-width="1.5"><path d="M12 2l2.9 6.5L22 9.3l-5 5 1.2 7.2L12 18l-6.2 3.5L7 14.3l-5-5 7.1-.8L12 2z" stroke-linejoin="round"/></svg>`;
}

function lockGlyph(){
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="2.4" style="flex-shrink:0"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>`;
}

function lockedRow(label, valueLabel){
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px">
      <span style="font-size:11px;color:#64748B">${label}</span>
      <span style="font-size:10.5px;color:#16233F;font-weight:600;display:flex;align-items:center;gap:4px">${valueLabel || '—'}${lockGlyph()}</span>
    </div>`;
}

function confirmRow(spotId, field, label, currentValue, yesLabel, noLabel, locked){
  if(locked){
    const valueLabel = currentValue === true ? yesLabel : currentValue === false ? noLabel : null;
    return lockedRow(label, valueLabel);
  }
  const yesActive = currentValue === true;
  const noActive = currentValue === false;
  const btnStyle = (active) =>
    `font-size:10.5px;padding:3px 9px;border-radius:999px;border:1.5px solid ${active ? '#16233F' : '#E7E2D8'};background:${active ? '#16233F' : '#fff'};color:${active ? '#fff' : '#16233F'};cursor:pointer`;
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px">
      <span style="font-size:11px;color:#64748B">${label}</span>
      <span style="display:flex;gap:4px;flex-shrink:0">
        <button type="button" onclick="confirmField('${spotId}','${field}',true)" style="${btnStyle(yesActive)}">${yesLabel}</button>
        <button type="button" onclick="confirmField('${spotId}','${field}',false)" style="${btnStyle(noActive)}">${noLabel}</button>
      </span>
    </div>`;
}

function confirmMultiRow(spotId, field, label, currentValue, options, locked){
  if(locked){
    const match = options.find(([value]) => value === currentValue);
    return lockedRow(label, match ? match[1] : null);
  }
  const buttons = options.map(([value, optLabel]) => {
    const active = currentValue === value;
    return `<button type="button" onclick="confirmField('${spotId}','${field}','${value}')" style="font-size:10px;padding:3px 8px;border-radius:999px;border:1.5px solid ${active ? '#16233F' : '#E7E2D8'};background:${active ? '#16233F' : '#fff'};color:${active ? '#fff' : '#16233F'};cursor:pointer">${optLabel}</button>`;
  }).join('');
  return `
    <div style="margin-top:5px">
      <div style="font-size:11px;color:#64748B;margin-bottom:3px">${label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px">${buttons}</div>
    </div>`;
}

function confirmLocationRow(spot){
  const options = ['feminino', 'masculino', 'familia', 'ambos'].map(opt => [opt, locationLabel(opt)]);
  return confirmMultiRow(spot.id, 'location', t('confirm.locationLabel'), spot.location, options, spot.locationConfirmed);
}

function confirmAccessTypeRow(spot){
  const options = [
    ['free', t('common.free')],
    ['paid', t('common.paid')],
    ['customers', t('common.customersOnly')],
  ];
  return confirmMultiRow(spot.id, 'access_type', t('confirm.paidLabel'), spot.accessType, options, spot.accessTypeConfirmed);
}

function confirmationsHtml(spot){
  const noTable = spot.hasChangingTable === false;
  const closedWarning = spot.stillOpen === false
    ? `<div style="background:#FEE2E2;color:#B91C1C;font-size:11px;padding:5px 8px;border-radius:8px;margin-top:6px">${t('confirm.closedWarning')}</div>`
    : '';
  const noTableWarning = noTable
    ? `<div style="background:#FEE2E2;color:#B91C1C;font-size:11px;padding:5px 8px;border-radius:8px;margin-top:6px">${t('confirm.noTableWarning')}</div>`
    : '';
  const hasTableRow = confirmRow(spot.id, 'has_changing_table', t('confirm.hasTableLabel'), spot.hasChangingTable, t('common.yes'), t('common.no'), spot.hasChangingTableConfirmed);

  // se já confirmaram que não tem trocador, o resto (tipo de banheiro,
  // pai, cobrança) não faz mais sentido de mostrar
  const restOfForm = noTable ? '' : `
      ${confirmLocationRow(spot)}
      ${confirmRow(spot.id, 'still_open', t('confirm.stillOpenLabel'), spot.stillOpen, t('confirm.open'), t('confirm.closed'), false)}
      ${confirmRow(spot.id, 'dad_allowed', t('confirm.dadLabel'), spot.dadAllowed, t('common.yes'), t('common.no'), spot.dadAllowedConfirmed)}
      ${confirmAccessTypeRow(spot)}`;

  return `
    ${closedWarning}
    ${noTableWarning}
    <div style="margin-top:8px;padding-top:8px;border-top:1px dashed #E7E2D8">
      <div style="font-size:10px;color:#94A3B8;margin-bottom:2px">${t('confirm.title')} · ${formatRelativeTime(spot.lastConfirmedAt)}</div>
      ${hasTableRow}
      ${restOfForm}
    </div>`;
}

function starsHtml(spotId, rating){
  const avg = rating ? rating.avg : 0;
  const count = rating ? rating.count : 0;
  const filled = Math.round(avg);
  const stars = Array.from({ length: 5 }, (_, i) => {
    const n = i + 1;
    return `<span onclick="rateSpot('${spotId}', ${n})" style="cursor:pointer;display:inline-flex;padding:2px">${starSvg(n <= filled)}</span>`;
  }).join('');
  const label = count
    ? t('rating.summary', { avg: avg.toFixed(1), count, unit: t(count === 1 ? 'rating.unitOne' : 'rating.unitOther') })
    : t('rating.beFirst');
  return `<div style="display:flex;align-items:center;margin-top:6px">${stars}<span style="font-size:11px;color:#94A3B8;margin-left:4px">${label}</span></div>`;
}

function photosHtml(spot){
  const photos = approvedPhotos.get(spot.id) || [];
  const thumbs = photos.map(p =>
    `<img src="${p.url}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex-shrink:0" />`
  ).join('');
  return `
    <div style="display:flex;align-items:center;gap:6px;margin-top:8px;overflow-x:auto">
      ${thumbs}
      <label style="display:flex;align-items:center;justify-content:center;width:44px;height:44px;border:1.5px dashed #CBD5E1;border-radius:8px;cursor:pointer;color:#94A3B8;font-size:20px;flex-shrink:0">
        +
        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="handlePhotoInput(event, '${spot.id}')">
      </label>
    </div>
    <div style="font-size:10px;color:#94A3B8;margin-top:3px">${t('photos.disclaimer')}</div>`;
}

function popupHtml(spot){
  const ref = referencePoint();
  const dist = ref ? formatDistance(distanceMeters(ref, spot)) : null;
  const isFav = favorites.has(spot.id);
  const noTable = spot.hasChangingTable === false;
  return `
    <div style="font-family:Inter,sans-serif;min-width:200px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
        <strong style="font-family:Fraunces,serif;font-size:14.5px;display:flex;align-items:center;gap:5px">${escapeHtml(spot.name)}${verifiedBadge(spot)}</strong>
        <span onclick="toggleFavorite('${spot.id}')" style="cursor:pointer;flex-shrink:0;margin-top:1px">${heartSvg(isFav)}</span>
      </div>
      <div style="font-size:12.5px;color:#64748B;margin-top:2px">${locationLabel(spot.location)}${dist ? ' · ' + dist : ''}</div>
      ${noTable ? '' : starsHtml(spot.id, ratingsSummary.get(spot.id))}
      ${spot.notes ? `<div style="font-size:12px;color:#94A3B8;margin-top:4px">${escapeHtml(spot.notes)}</div>` : ''}
      ${noTable ? '' : photosHtml(spot)}
      ${confirmationsHtml(spot)}
      <div style="display:flex;gap:14px;margin-top:8px">
        <a href="https://www.google.com/maps/dir/?api=1&destination=${spot.lat},${spot.lng}" target="_blank"
           style="font-size:12.5px;font-weight:600;color:#FF6B5C;text-decoration:none">
          ${t('maps.google')}
        </a>
        <a href="https://maps.apple.com/?daddr=${spot.lat},${spot.lng}" target="_blank"
           style="font-size:12.5px;font-weight:600;color:#FF6B5C;text-decoration:none">
          ${t('maps.apple')}
        </a>
      </div>
    </div>`;
}

function escapeHtml(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function locateUser(){
  if(!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLatLng = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if(userMarker) map.removeLayer(userMarker);
      userMarker = L.marker([userLatLng.lat, userLatLng.lng], {
        icon: pinIcon('pin-me', meGlyph),
        zIndexOffset: 1000,
      }).addTo(map).bindPopup(t('map.youAreHere'));
      map.setView([userLatLng.lat, userLatLng.lng], 15);
      renderList();
    },
    () => { /* usuário negou — segue com fallback CABA */ },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

// ---------------- Lista (sheet) ----------------
const appEl = document.getElementById('app');
const sheet = document.getElementById('sheet');
const sheetHandle = document.getElementById('sheet-handle');
const sheetHeader = document.querySelector('.sheet-header');
const sheetList = document.getElementById('sheet-list');
const sheetCount = document.getElementById('sheet-count');
const sheetTitle = document.getElementById('sheet-title');
const listToggleBtn = document.getElementById('btn-list-toggle');
const sheetBackdrop = document.getElementById('sheet-backdrop');

function renderList(){
  const ref = referencePoint();
  const withDist = spots.map(s => ({
    ...s,
    dist: ref ? distanceMeters(ref, s) : null,
  }));
  withDist.sort((a, b) => {
    const aNoTable = a.hasChangingTable === false ? 1 : 0;
    const bNoTable = b.hasChangingTable === false ? 1 : 0;
    if(aNoTable !== bNoTable) return aNoTable - bNoTable;
    const aFav = favorites.has(a.id) ? 0 : 1;
    const bFav = favorites.has(b.id) ? 0 : 1;
    if(aFav !== bFav) return aFav - bFav;
    if(a.dist == null) return 0;
    if(b.dist == null) return -1;
    return a.dist - b.dist;
  });

  sheetCount.textContent = spots.length;
  sheetTitle.textContent = browsingLocation ? t('sheet.nearPlace', { place: browsingLocation.label }) : t('sheet.nearYou');

  if(!spots.length){
    sheetList.innerHTML = `
      <div class="empty-state">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M9 12h6M12 9v6"/></svg>
        <p>${t('empty.line1')}<br>${t('empty.line2')}</p>
      </div>`;
    return;
  }

  sheetList.innerHTML = withDist.map(spot => {
    const rating = ratingsSummary.get(spot.id);
    const ratingLabel = rating?.count ? ` · ★ ${rating.avg.toFixed(1)}` : '';
    const noTable = spot.hasChangingTable === false;
    const closedLabel = !noTable && spot.stillOpen === false ? ` · <span style="color:#B91C1C">${t('confirm.closed')}</span>` : '';
    const noTableLabel = noTable ? ` · <span style="color:#B91C1C">${t('list.noTable')}</span>` : '';
    return `
    <div class="spot-card" data-id="${spot.id}" style="${noTable ? 'opacity:0.6' : ''}">
      <div class="spot-badge ${spotPinClass(spot)}">${spotPinGlyph(spot)}</div>
      <div class="spot-info">
        <p class="spot-name" style="display:flex;align-items:flex-start;gap:4px"><span>${escapeHtml(spot.name)}</span>${verifiedBadge(spot)}</p>
        <p class="spot-meta">${locationLabel(spot.location)}${ratingLabel}${closedLabel}${noTableLabel}</p>
        ${spot.notes ? `<p class="spot-notes">${escapeHtml(spot.notes)}</p>` : ''}
      </div>
      <button type="button" class="spot-fav" data-fav-toggle="${spot.id}" aria-label="${t('favorite.ariaLabel')}">${heartSvg(favorites.has(spot.id))}</button>
      ${spot.dist != null ? `<span class="spot-dist">${formatDistance(spot.dist)}</span>` : ''}
    </div>
  `;
  }).join('');
}

sheetList.addEventListener('click', (e) => {
  const favBtn = e.target.closest('[data-fav-toggle]');
  if(favBtn){
    toggleFavorite(favBtn.dataset.favToggle);
    return;
  }
  const card = e.target.closest('.spot-card');
  if(!card) return;
  const spot = spots.find(s => s.id === card.dataset.id);
  if(!spot) return;
  map.setView([spot.lat, spot.lng], 17);
  markers.get(spot.id)?.openPopup();
  closeSheet();
});

function openSheet(){ sheet.classList.add('open'); appEl.classList.add('sheet-open'); }
function closeSheet(){ sheet.classList.remove('open'); appEl.classList.remove('sheet-open'); }
function toggleSheet(){
  const willOpen = !sheet.classList.contains('open');
  sheet.classList.toggle('open', willOpen);
  appEl.classList.toggle('sheet-open', willOpen);
}

listToggleBtn.addEventListener('click', toggleSheet);
sheetBackdrop.addEventListener('click', closeSheet);

// arrastar o sheet (touch simples) — área de toque é o cabeçalho inteiro,
// não só o tracinho (muito pequeno pra acertar num celular de verdade)
let dragStartY = null;
function onDragStart(e){ dragStartY = e.touches[0].clientY; }
function onDragEnd(e){
  if(dragStartY == null) return;
  const dy = e.changedTouches[0].clientY - dragStartY;
  if(dy < -20) openSheet();
  if(dy > 20) closeSheet();
  dragStartY = null;
}
[sheetHandle, sheetHeader].forEach(el => {
  el.addEventListener('touchstart', onDragStart);
  el.addEventListener('touchend', onDragEnd);
  el.addEventListener('click', toggleSheet);
});

// ---------------- Botão farol: achar o mais perto AGORA ----------------
document.getElementById('beacon-btn').addEventListener('click', () => {
  const candidates = spots.filter(s => s.hasChangingTable !== false);
  if(!candidates.length){
    showToast(t('toast.needSpotFirst'));
    return;
  }
  const ref = referencePoint();
  if(!ref){
    showToast(t('toast.locating'));
    locateUser();
    return;
  }
  const nearest = [...candidates].sort((a,b) =>
    distanceMeters(ref, a) - distanceMeters(ref, b)
  )[0];
  map.setView([nearest.lat, nearest.lng], 17);
  markers.get(nearest.id)?.openPopup();
  showToast(t('toast.nearest', { name: nearest.name, dist: formatDistance(distanceMeters(ref, nearest)) }));
  closeSheet();
});

// ---------------- Formulário ----------------
const formPanel = document.getElementById('form-panel');
const addBtn = document.getElementById('add-btn');
const formClose = document.getElementById('form-close');
const fAddressSearch = document.getElementById('f-address-search');
const fAddressResults = document.getElementById('f-address-results');
const fName = document.getElementById('f-name');
const fNotes = document.getElementById('f-notes');
const fSave = document.getElementById('f-save');
const fCoordsHint = document.getElementById('f-coords-hint');
const chipButtons = document.querySelectorAll('#f-location-chips .chip');
const dadChips = document.querySelectorAll('#f-dad-chips .chip');
const paidChips = document.querySelectorAll('#f-paid-chips .chip');
let selectedLocation = null;
let selectedDadAllowed = null; // true / false / null (não informado)
let selectedAccessType = null; // 'free' / 'paid' / 'customers' / null
let pendingMarker = null;

// grupos opcionais: clicar de novo desmarca (volta pra "não informado")
// onChange recebe o valor cru do data-value (string); quem chama decide
// se precisa converter pra boolean ou não.
function wireOptionalChipGroup(chips, onChange){
  let current = null;
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.value;
      if(current === val){
        current = null;
        chips.forEach(c => c.classList.remove('active'));
      }else{
        current = val;
        chips.forEach(c => c.classList.toggle('active', c === chip));
      }
      onChange(current);
    });
  });
  return {
    reset(){ current = null; chips.forEach(c => c.classList.remove('active')); },
  };
}
const dadChipGroup = wireOptionalChipGroup(dadChips, v => selectedDadAllowed = v === null ? null : v === 'true');
const paidChipGroup = wireOptionalChipGroup(paidChips, v => selectedAccessType = v);

addBtn.addEventListener('click', () => openForm());
formClose.addEventListener('click', closeForm);

function openForm(){
  editingId = null;
  fName.value = '';
  fNotes.value = '';
  selectedLocation = null;
  selectedDadAllowed = null;
  selectedAccessType = null;
  pendingLatLng = userLatLng ? { ...userLatLng } : null;
  chipButtons.forEach(c => c.classList.remove('active'));
  dadChipGroup.reset();
  paidChipGroup.reset();
  fAddressSearch.value = '';
  renderAddressResults([]);
  updateCoordsHint();
  validateForm();
  formPanel.classList.add('open');
  formPanel.setAttribute('aria-hidden', 'false');
}
function closeForm(){
  formPanel.classList.remove('open');
  formPanel.setAttribute('aria-hidden', 'true');
  if(pendingMarker){ map.removeLayer(pendingMarker); pendingMarker = null; }
}

chipButtons.forEach(chip => {
  chip.addEventListener('click', () => {
    chipButtons.forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    selectedLocation = chip.dataset.value;
    validateForm();
  });
});

document.getElementById('f-use-location').addEventListener('click', () => {
  if(userLatLng){
    setPendingLocation(userLatLng.lat, userLatLng.lng);
  }else{
    showToast(t('toast.noLocationYet'));
    locateUser();
  }
});

function setPendingLocation(lat, lng){
  pendingLatLng = { lat, lng };
  if(pendingMarker) map.removeLayer(pendingMarker);
  pendingMarker = L.marker([lat, lng], { icon: pinIcon('pin-me', meGlyph) }).addTo(map);
  updateCoordsHint();
  validateForm();
}
function updateCoordsHint(){
  fCoordsHint.textContent = pendingLatLng ? t('form.hintSet') : t('form.hintDefault');
}

// -------- Busca de endereço (Nominatim/OpenStreetMap, sem chave de API) --------
// Enviesa os resultados pra região de Buenos Aires sem excluir o resto do mundo.
const BA_VIEWBOX = '-58.65,-34.45,-58.25,-34.85';

async function searchAddress(query){
  const params = new URLSearchParams({
    format: 'json',
    q: query,
    limit: '5',
    addressdetails: '1',
    viewbox: BA_VIEWBOX,
    bounded: '0',
    'accept-language': LOCALE,
  });
  try{
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
    if(!res.ok) return [];
    return await res.json();
  }catch(e){
    console.error('Erro ao buscar endereço:', e);
    return [];
  }
}

function renderAddressResults(results){
  if(!results.length){
    fAddressResults.innerHTML = '';
    return;
  }
  fAddressResults.innerHTML = results.map((item, i) =>
    `<button type="button" class="address-result-item" data-idx="${i}">${escapeHtml(item.display_name)}</button>`
  ).join('');
  fAddressResults.querySelectorAll('.address-result-item').forEach((btn, i) => {
    btn.addEventListener('click', () => selectAddressResult(results[i]));
  });
}

function selectAddressResult(item){
  const lat = parseFloat(item.lat);
  const lng = parseFloat(item.lon);
  setPendingLocation(lat, lng);
  map.setView([lat, lng], 17);
  if(!fName.value.trim()){
    fName.value = (item.display_name || '').split(',')[0];
    validateForm();
  }
  fAddressSearch.value = item.display_name;
  renderAddressResults([]);
}

let addressSearchTimer = null;
fAddressSearch.addEventListener('input', () => {
  clearTimeout(addressSearchTimer);
  const query = fAddressSearch.value.trim();
  if(query.length < 3){
    renderAddressResults([]);
    return;
  }
  addressSearchTimer = setTimeout(async () => {
    renderAddressResults(await searchAddress(query));
  }, 450);
});

// -------- Busca de lugar na tela principal --------
// "Ver perto de" um endereço buscado, em vez de perto da localização real.
// Reaproveita searchAddress() de cima, só muda o que acontece ao escolher.
const searchToggleBtn = document.getElementById('btn-search-toggle');
const locationSearchPanel = document.getElementById('location-search-panel');
const locationSearchInput = document.getElementById('location-search-input');
const locationSearchResults = document.getElementById('location-search-results');
const browsingChip = document.getElementById('browsing-chip');
const browsingChipLabel = document.getElementById('browsing-chip-label');
const browsingChipClear = document.getElementById('browsing-chip-clear');

function openLocationSearch(){
  locationSearchPanel.classList.add('open');
  locationSearchInput.value = '';
  locationSearchResults.innerHTML = '';
  locationSearchInput.focus();
}
function closeLocationSearch(){
  locationSearchPanel.classList.remove('open');
  locationSearchResults.innerHTML = '';
}
searchToggleBtn.addEventListener('click', () => {
  if(locationSearchPanel.classList.contains('open')) closeLocationSearch();
  else openLocationSearch();
});

function renderLocationSearchResults(results){
  if(!results.length){
    locationSearchResults.innerHTML = '';
    return;
  }
  locationSearchResults.innerHTML = results.map((item, i) =>
    `<button type="button" class="address-result-item" data-idx="${i}">${escapeHtml(item.display_name)}</button>`
  ).join('');
  locationSearchResults.querySelectorAll('.address-result-item').forEach((btn, i) => {
    btn.addEventListener('click', () => selectBrowsingLocation(results[i]));
  });
}

function selectBrowsingLocation(item){
  const lat = parseFloat(item.lat);
  const lng = parseFloat(item.lon);
  browsingLocation = { lat, lng, label: (item.display_name || '').split(',')[0] };
  map.setView([lat, lng], 15);
  closeLocationSearch();
  browsingChipLabel.textContent = t('search.browsing', { place: browsingLocation.label });
  browsingChip.hidden = false;
  renderList();
  renderAllMarkers();
}

browsingChipClear.addEventListener('click', () => {
  browsingLocation = null;
  browsingChip.hidden = true;
  renderList();
  renderAllMarkers();
  if(userLatLng) map.setView([userLatLng.lat, userLatLng.lng], 15);
});

let locationSearchTimer = null;
locationSearchInput.addEventListener('input', () => {
  clearTimeout(locationSearchTimer);
  const query = locationSearchInput.value.trim();
  if(query.length < 3){
    renderLocationSearchResults([]);
    return;
  }
  locationSearchTimer = setTimeout(async () => {
    renderLocationSearchResults(await searchAddress(query));
  }, 450);
});

[fName].forEach(el => el.addEventListener('input', validateForm));
function validateForm(){
  fSave.disabled = !(fName.value.trim() && selectedLocation && pendingLatLng);
}

fSave.addEventListener('click', async () => {
  if(fSave.disabled) return;
  const spot = {
    id: editingId || `spot-${Date.now()}`,
    name: fName.value.trim(),
    lat: pendingLatLng.lat,
    lng: pendingLatLng.lng,
    location: selectedLocation,
    notes: fNotes.value.trim(),
    dadAllowed: selectedDadAllowed,
    accessType: selectedAccessType,
    stillOpen: true,
    locationConfirmed: true,
    dadAllowedConfirmed: selectedDadAllowed !== null,
    accessTypeConfirmed: selectedAccessType !== null,
    hasChangingTable: true,
    hasChangingTableConfirmed: true,
    lastConfirmedAt: Date.now(),
    verified: true,
    createdAt: Date.now(),
  };
  fSave.disabled = true;
  const ok = await saveSpot(spot);
  fSave.disabled = false;
  if(!ok) return;
  const idx = spots.findIndex(s => s.id === spot.id);
  if(idx >= 0) spots[idx] = spot; else spots.push(spot);
  renderAllMarkers();
  renderList();
  closeForm();
  showToast(t('toast.spotSaved'));
});

// ---------------- Toast ----------------
let toastTimer = null;
function showToast(msg){
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---------------- Boot ----------------
async function boot(){
  spots = await loadSpots();
  await Promise.all([loadRatingsSummary(), loadApprovedPhotos()]);
  initMap();
  renderList();
  subscribeToNewSpots();
}
boot();

// Registra o service worker (funcionamento offline básico)
if('serviceWorker' in navigator){
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
