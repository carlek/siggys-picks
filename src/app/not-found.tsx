import React from 'react'

export default function NotFound() {
  return (
    <html>
      <head>
        <title>You're Early....</title>
        <meta name="viewport" content="width=device-width,initial-scale=1" />
      </head>
      <body style={{display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh',margin:0,fontFamily:'system-ui,Segoe UI,Roboto,Arial',background:'#f8fafc',color:'#0f172a'}}>
        <div style={{textAlign:'center',padding:24}}>
          <img src="/siggys-picks.jpeg" alt="Coming soon: NHL Siggys Picks" style={{maxWidth:'80vw',height:'auto',borderRadius:8,boxShadow:'0 6px 18px rgba(15,23,42,0.08)'}} />
          <h1 style={{margin:'18px 0 6px',fontSize:'1.5rem'}}>Coming soon: NHL Siggys Picks</h1>
          <p style={{opacity:.8,margin:0}}>...merreoww !</p>
        </div>
      </body>
    </html>
  )
}
