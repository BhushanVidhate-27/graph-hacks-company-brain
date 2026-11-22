import type {ReactNode} from 'react';
export function Reveal({className,children}: {className?: string;children?: ReactNode;delay?: number}){ return <div className={className}>{children}</div>; }
