import Link from "next/link";

export default function NotFound() {
  return <main className="page-width empty-state"><h1>This page could not be found.</h1><p>Return to the store to explore our groundnut oil.</p><Link className="button primary" href="/">Go home</Link></main>;
}
