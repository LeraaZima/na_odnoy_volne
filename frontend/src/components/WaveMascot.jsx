import { useId } from 'react';

// Два самостоятельных потока, общий гребень и тонкие линии течения.
// Каждый слой редактируется отдельно; никакой зависимости от логики Match.
export function WaveMascot({className='',celebration=false}) {
  const id=useId();
  const left='M42 269C123 276 155 248 182 193C206 143 244 120 281 137C304 148 315 171 307 192C298 174 281 169 266 181C244 198 253 233 281 253C307 271 331 278 354 280C245 324 133 320 42 269Z';
  return <svg className={`sea-wave ${className} ${celebration?'sea-wave--match':''}`} viewBox="0 50 640 310" role="img" aria-label="Две волны соединяются в одну">
    <defs>
      <linearGradient id={`${id}-violet`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#6665d8"/><stop offset=".55" stopColor="#9d83e9"/><stop offset="1" stopColor="#d8c5f6"/></linearGradient>
      <linearGradient id={`${id}-blue`} x1="0" y1="1" x2="1" y2="0"><stop stopColor="#6aaecb"/><stop offset=".55" stopColor="#9bbfe4"/><stop offset="1" stopColor="#e6b5da"/></linearGradient>
      <linearGradient id={`${id}-joined`} x1="0" y1=".8" x2="1" y2=".2"><stop stopColor="#8baedc"/><stop offset=".45" stopColor="#9281e0"/><stop offset=".78" stopColor="#c2a0e9"/><stop offset="1" stopColor="#dfb5d8"/></linearGradient>
    </defs>
    <g className="sea-wave__pair">
      <g className="sea-wave__left" data-layer="violet-wave">
        <path fill={`url(#${id}-violet)`} d={left}/>
        <path fill="#e3d3fa" opacity=".3" d="M61 279C151 285 177 241 200 198C225 151 259 139 285 152C249 146 228 179 217 213C197 270 147 303 61 279Z"/>
        <path className="sea-wave__line" d="M88 282C165 283 181 244 208 194C229 157 253 148 275 155"/>
      </g>
      <g className="sea-wave__right" data-layer="blue-wave">
        <g transform="translate(640 0) scale(-1 1)">
          <path fill={`url(#${id}-blue)`} opacity=".87" d={left}/>
          <path fill="#f2d8ed" opacity=".28" d="M61 279C151 285 177 241 200 198C225 151 259 139 285 152C249 146 228 179 217 213C197 270 147 303 61 279Z"/>
          <path className="sea-wave__line" d="M88 282C165 283 181 244 208 194C229 157 253 148 275 155"/>
        </g>
      </g>
      <path data-layer="shared-current" className="sea-wave__bridge" fill={`url(#${id}-joined)`} opacity=".35" d="M110 286C205 256 242 305 320 279C395 251 444 269 530 286C446 326 382 303 320 312C247 325 179 322 110 286Z"/>
    </g>
    <g className="sea-wave__union" data-layer="united-wave">
      <path fill={`url(#${id}-joined)`} d="M64 278C173 292 222 243 255 179C286 119 333 94 382 110C420 122 444 159 430 189C418 164 392 153 368 169C333 194 354 235 390 254C439 280 489 282 576 271C476 326 353 333 274 312C193 330 125 309 64 278Z"/>
      <path fill="#eadff8" opacity=".3" d="M99 289C207 296 241 220 273 169C306 116 356 107 391 129C347 117 313 146 295 182C267 239 235 302 161 305Z"/>
      <path className="sea-wave__line" d="M125 292C215 288 246 223 278 170C305 128 342 117 371 126M325 295C406 307 476 293 517 288"/>
    </g>
  </svg>;
}
