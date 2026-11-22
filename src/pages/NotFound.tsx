import {useEffect} from 'react';
import {Link} from 'react-router-dom';
import {setSeo,noIndex} from '../lib/seo';
export default function NotFound(){
  useEffect(()=>{setSeo({title:'Page not found | Vorlen',description:'The page you requested could not be found. Browse Vorlen recruitment services or contact the team.',robots:noIndex})},[]);
  return <main className="public page-not-found"><section><p className="vorlen-eyebrow">404 · PAGE NOT FOUND</p><h1>This page isn't here.</h1><p>The address may have changed or the page may have been removed. Use the links below to continue.</p><p><Link to="/">Vorlen homepage</Link> · <Link to="/employers">Employer recruitment</Link> · <Link to="/careers">Current opportunities</Link> · <Link to="/contact">Contact</Link></p></section></main>
}
