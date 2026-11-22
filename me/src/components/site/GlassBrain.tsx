export function GlassBrain({className}: {className?: string}) {
  return <div className={className} aria-hidden="true" style={{pointerEvents:'none', overflow:'hidden', background:'#0a0b10'}}>
    <img src="/brain-preview.png" alt="" style={{width:'100%',height:'100%',objectFit:'cover',clipPath:'inset(0 0 8% 0)',opacity:0.32}} />
  </div>;
}
