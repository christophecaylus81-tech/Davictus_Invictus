/**
 * Davitus Invictus — figure constellation SVG
 * Gauche : bleu stellaire  /  Droite : orange solaire
 */

const CX = 250
const BLUE   = '#38bdf8'
const ORANGE = '#f59e0b'
const WHITE  = '#e8f0ff'

function col(x: number): string {
  if (x < CX - 15) return BLUE
  if (x > CX + 15) return ORANGE
  return WHITE
}

const NODES = [
  // Couronne
  { id: 'cl',  x: 192, y: 34,  r: 4 },
  { id: 'cc',  x: 250, y: 10,  r: 5 },
  { id: 'cr',  x: 308, y: 34,  r: 4 },
  { id: 'cbl', x: 210, y: 62,  r: 3 },
  { id: 'cbr', x: 290, y: 62,  r: 3 },
  // Tête
  { id: 'hl',  x: 220, y: 76,  r: 2.5 },
  { id: 'hr',  x: 280, y: 76,  r: 2.5 },
  { id: 'hb',  x: 250, y: 100, r: 3 },
  // Cou
  { id: 'n',   x: 250, y: 118, r: 2 },
  // Épaules
  { id: 'sl',  x: 178, y: 136, r: 4 },
  { id: 'sr',  x: 322, y: 136, r: 4 },
  // Torse
  { id: 'ct',  x: 250, y: 150, r: 3 },
  { id: 'bl2', x: 200, y: 210, r: 3 },
  { id: 'br2', x: 300, y: 210, r: 3 },
  { id: 'bb',  x: 250, y: 270, r: 3 },
  // Bras gauche
  { id: 'al1', x: 120, y: 192, r: 3 },
  { id: 'al2', x: 72,  y: 250, r: 3 },
  // Bras droit
  { id: 'ar1', x: 380, y: 192, r: 3 },
  { id: 'ar2', x: 428, y: 250, r: 3 },
  // Satellites gauche
  { id: 's1',  x: 150, y: 48,  r: 2 },
  { id: 's2',  x: 162, y: 94,  r: 1.8 },
  { id: 's3',  x: 140, y: 162, r: 2 },
  { id: 's4',  x: 95,  y: 124, r: 1.8 },
  { id: 's5',  x: 58,  y: 168, r: 2.2 },
  { id: 's6',  x: 36,  y: 215, r: 1.8 },
  // Satellites droite
  { id: 's7',  x: 350, y: 48,  r: 2 },
  { id: 's8',  x: 338, y: 94,  r: 1.8 },
  { id: 's9',  x: 360, y: 162, r: 2 },
  { id: 's10', x: 405, y: 124, r: 1.8 },
  { id: 's11', x: 442, y: 168, r: 2.2 },
  { id: 's12', x: 464, y: 215, r: 1.8 },
]

const EDGES: [string, string][] = [
  ['cl','cc'],['cc','cr'],['cl','cbl'],['cr','cbr'],['cbl','cbr'],
  ['cbl','hl'],['cbr','hr'],['hl','hb'],['hr','hb'],['hb','n'],
  ['n','sl'],['n','sr'],['n','ct'],
  ['sl','ct'],['sr','ct'],
  ['sl','bl2'],['ct','bl2'],['sr','br2'],['ct','br2'],
  ['bl2','bb'],['br2','bb'],['bl2','br2'],
  ['sl','al1'],['al1','al2'],
  ['sr','ar1'],['ar1','ar2'],
  ['s1','cl'],['s1','cbl'],
  ['s2','hl'],['s2','sl'],
  ['s3','sl'],['s3','al1'],
  ['s4','s3'],['s4','s5'],
  ['s5','al1'],['s5','al2'],
  ['s6','al2'],
  ['s7','cr'],['s7','cbr'],
  ['s8','hr'],['s8','sr'],
  ['s9','sr'],['s9','ar1'],
  ['s10','s9'],['s10','s11'],
  ['s11','ar1'],['s11','ar2'],
  ['s12','ar2'],
]

const nodeMap: Record<string, {x:number;y:number}> = {}
for (const n of NODES) nodeMap[n.id] = {x: n.x, y: n.y}

const ORB_L = { x: 40,  y: 295, r: 30 }
const ORB_R = { x: 460, y: 295, r: 30 }

export default function DavitusConstellation({ opacity = 0.38 }: { opacity?: number }) {
  return (
    <svg
      viewBox="0 0 500 345"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '88vmin',
        height: 'auto',
        pointerEvents: 'none',
        opacity,
        zIndex: 1,
        overflow: 'visible',
      }}
    >
      <defs>
        <filter id="dv-glow-b" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="dv-glow-o" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="dv-glow-w" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="6" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <filter id="dv-orb" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation="10" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <radialGradient id="dv-orb-l" cx="35%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#fff"  stopOpacity="1"/>
          <stop offset="40%"  stopColor={BLUE}  stopOpacity="0.9"/>
          <stop offset="100%" stopColor={BLUE}  stopOpacity="0.2"/>
        </radialGradient>
        <radialGradient id="dv-orb-r" cx="35%" cy="35%" r="65%">
          <stop offset="0%"   stopColor="#fff"    stopOpacity="1"/>
          <stop offset="40%"  stopColor={ORANGE}  stopOpacity="0.9"/>
          <stop offset="100%" stopColor={ORANGE}  stopOpacity="0.2"/>
        </radialGradient>
      </defs>

      {/* ── Lignes ── */}
      {EDGES.map(([a, b], i) => {
        const na = nodeMap[a]; const nb = nodeMap[b]
        if (!na || !nb) return null
        const c = col((na.x + nb.x) / 2)
        return (
          <line key={i}
            x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            stroke={c} strokeWidth={1.2} strokeOpacity={0.75}
          />
        )
      })}

      {/* bras → orbes */}
      {nodeMap['al2'] && <line x1={nodeMap['al2']!.x} y1={nodeMap['al2']!.y} x2={ORB_L.x} y2={ORB_L.y} stroke={BLUE} strokeWidth={1.2} strokeOpacity={0.7}/>}
      {nodeMap['ar2'] && <line x1={nodeMap['ar2']!.x} y1={nodeMap['ar2']!.y} x2={ORB_R.x} y2={ORB_R.y} stroke={ORANGE} strokeWidth={1.2} strokeOpacity={0.7}/>}

      {/* ── Orbe gauche ── */}
      <circle cx={ORB_L.x} cy={ORB_L.y} r={ORB_L.r + 16} fill="none" stroke={BLUE} strokeWidth={0.5} strokeOpacity={0.2}>
        <animate attributeName="r" values={`${ORB_L.r+14};${ORB_L.r+22};${ORB_L.r+14}`} dur="3s" repeatCount="indefinite"/>
      </circle>
      <circle cx={ORB_L.x} cy={ORB_L.y} r={ORB_L.r+7} fill="none" stroke={BLUE} strokeWidth={0.8} strokeOpacity={0.35}/>
      <circle cx={ORB_L.x} cy={ORB_L.y} r={ORB_L.r} fill="url(#dv-orb-l)" filter="url(#dv-orb)"/>

      {/* ── Orbe droit ── */}
      <circle cx={ORB_R.x} cy={ORB_R.y} r={ORB_R.r + 16} fill="none" stroke={ORANGE} strokeWidth={0.5} strokeOpacity={0.2}>
        <animate attributeName="r" values={`${ORB_R.r+14};${ORB_R.r+22};${ORB_R.r+14}`} dur="3.6s" repeatCount="indefinite"/>
      </circle>
      <circle cx={ORB_R.x} cy={ORB_R.y} r={ORB_R.r+7} fill="none" stroke={ORANGE} strokeWidth={0.8} strokeOpacity={0.35}/>
      <circle cx={ORB_R.x} cy={ORB_R.y} r={ORB_R.r} fill="url(#dv-orb-r)" filter="url(#dv-orb)"/>

      {/* ── Étoiles / nœuds ── */}
      {NODES.map(n => {
        const c = col(n.x)
        const filterId = n.x < CX - 15 ? 'dv-glow-b' : n.x > CX + 15 ? 'dv-glow-o' : 'dv-glow-w'
        const r = n.r ?? 2.5
        return (
          <g key={n.id} filter={`url(#${filterId})`}>
            <circle cx={n.x} cy={n.y} r={r + 3} fill={c} fillOpacity={0.2}/>
            <circle cx={n.x} cy={n.y} r={r} fill={c} fillOpacity={1}/>
            {r >= 3.5 && (
              <circle cx={n.x} cy={n.y} r={r + 2} fill="none" stroke={c} strokeWidth={0.5} strokeOpacity={0.25}>
                <animate attributeName="r"
                  values={`${r+1.5};${r+5};${r+1.5}`}
                  dur={`${2.2 + (n.x * 0.007)}s`}
                  repeatCount="indefinite"/>
                <animate attributeName="stroke-opacity"
                  values="0.25;0.05;0.25"
                  dur={`${2.2 + (n.x * 0.007)}s`}
                  repeatCount="indefinite"/>
              </circle>
            )}
          </g>
        )
      })}

      {/* ── Cœur central (point blanc lumineux) ── */}
      <g filter="url(#dv-glow-w)">
        <circle cx={CX} cy={150} r={6} fill={WHITE} fillOpacity={0.95}/>
        <circle cx={CX} cy={150} r={12} fill={WHITE} fillOpacity={0.12}>
          <animate attributeName="r" values="10;18;10" dur="2.5s" repeatCount="indefinite"/>
          <animate attributeName="fill-opacity" values="0.12;0.03;0.12" dur="2.5s" repeatCount="indefinite"/>
        </circle>
      </g>
    </svg>
  )
}
