'use client';
import { ThemeProvider, useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
export function AppearanceProvider({children}:{children:ReactNode}){
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="vantage-appearance-v3" disableTransitionOnChange>{children}</ThemeProvider>;
}
export function ThemeControls(){
  const {setTheme,theme}=useTheme();
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  return <div className="theme-controls" aria-label="화면 테마 선택"><button className="choose-light" aria-pressed={mounted&&theme==='light'} onClick={()=>setTheme('light')} aria-label="밝은 테마"><Sun size={15}/><span>Light</span></button><button className="choose-dark" aria-pressed={mounted&&theme==='dark'} onClick={()=>setTheme('dark')} aria-label="어두운 테마"><Moon size={15}/><span>Dark</span></button></div>;
}
