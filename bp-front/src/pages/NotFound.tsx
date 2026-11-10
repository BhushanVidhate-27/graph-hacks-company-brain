import React from 'react';
import { Link } from 'react-router-dom';
import { Nav } from '../components/Nav';
import { Footer } from '../components/Footer';
import { Button } from '../components/ui';

const NotFound: React.FC = () => (
  <>
    <Nav />
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center px-5 py-32 text-center">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.02em]">This page is not in the graph.</h1>
      <p className="mt-4 max-w-md text-fog">
        The route does not exist. Head home, or ask the graph something useful.
      </p>
      <div className="mt-8 flex gap-3">
        <Link to="/">
          <Button variant="outline">Back home</Button>
        </Link>
        <Link to="/agent">
          <Button>Ask the graph</Button>
        </Link>
      </div>
    </main>
    <Footer />
  </>
);

export default NotFound;
