import {Link} from '@tanstack/react-router';
export function Nav() {
  return <header className="glass fixed inset-x-6 top-4 z-50 mx-auto flex max-w-6xl items-center justify-between rounded-full px-6 py-3">
    <Link to="/" className="font-semibold">Helio</Link>
    <nav className="flex gap-5 text-sm"><Link to="/how-it-works">How it works</Link><Link to="/sources">Sources</Link><Link to="/trust">Trust</Link></nav>
    <Link to="/access" className="text-sm font-semibold">Get early access</Link>
  </header>;
}
