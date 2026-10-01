'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { api } from '@/lib/api';

function Logo() { return <div className="ts-logo"><span>T</span><b>Trackster</b></div>; }
function Mascot() { return <div className="ts-big-mascot" aria-hidden="true"><div className="ts-mascot">T</div><div className="ts-bubble">Kopi Kenangan Rp32.000 baru masuk.<br /><small>Sisa hari ini Rp168.000.</small></div></div>; }
export default function LoginPage() {
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[show,setShow]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(false); const router=useRouter();
 const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setError('');setLoading(true);try{await api.post('/auth/login',{username,password});router.push('/app');router.refresh();}catch(err:any){setError(err.message||'Login gagal');}finally{setLoading(false);}};
 return <main className="ts-page ts-login-page"><section className="ts-login-main"><header className="ts-header"><button className="ts-back" onClick={()=>router.push('/')}><ArrowLeft size={18}/>Beranda</button><Logo/></header><div className="ts-form-center"><form onSubmit={submit} className="ts-login-form"><div><h1>Masuk</h1><p>Lanjut lihat sisa budget hari ini.</p></div><div className="ts-fields"><label>Username<input value={username} onChange={e=>{setUsername(e.target.value);setError('')}} autoFocus autoComplete="username" aria-invalid={!!error}/></label><label>Password<span className="ts-password"><input type={show?'text':'password'} value={password} onChange={e=>{setPassword(e.target.value);setError('')}} autoComplete="current-password" aria-invalid={!!error}/><button type="button" onClick={()=>setShow(!show)} aria-label={show?'Sembunyikan password':'Tampilkan password'}>{show?<EyeOff size={18}/>:<Eye size={18}/>}</button></span></label><p className="ts-error" role="alert">{error&&<><AlertTriangle size={15}/>{error}</>}</p></div><button className="ts-submit" disabled={loading}>{loading&&<LoaderCircle size={18} className="animate-spin"/>}{loading?'Masuk…':'Masuk'}</button><p className="ts-device-note">Kamu tetap masuk di perangkat ini sampai keluar sendiri.</p><p className="ts-private">Finance Tracker masih private. Belum punya akses? <button type="button" onClick={()=>router.push('/')}><u>Masuk antrean.</u></button></p></form></div></section><aside className="ts-login-aside"><Mascot/></aside></main>;
}
