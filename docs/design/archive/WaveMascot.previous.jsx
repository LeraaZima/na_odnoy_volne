import { useId } from 'react';

// Авторский SVG: отдельные потоки, гребень, блики и небольшие глаза.
export function WaveMascot({className='',celebration=false}) {
  const id=useId();
  return <svg className={`sea-wave ${className} ${celebration?'sea-wave--match':''}`} viewBox="0 0 640 430" role="img" aria-label="Фирменная морская волна">
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="1" x2=".8" y2="0"><stop stopColor="#62d8e8"/><stop offset=".45" stopColor="#8471e9"/><stop offset="1" stopColor="#c9b0ff"/></linearGradient>
      <linearGradient id={`${id}-front`} x2="1" y2=".3"><stop stopColor="#a1e9ef"/><stop offset=".5" stopColor="#8960de"/><stop offset="1" stopColor="#f1afdf"/></linearGradient>
      <linearGradient id={`${id}-crest`} x2=".8" y2="1"><stop stopColor="#faf4ff"/><stop offset="1" stopColor="#c6a8f4" stopOpacity=".35"/></linearGradient>
    </defs>
    <g className="sea-wave__ripples" fill="none" stroke="#b995ef" strokeWidth="2" opacity=".4"><ellipse cx="320" cy="350" rx="215" ry="35"/><ellipse cx="320" cy="350" rx="275" ry="55"/></g>
    <g className="sea-wave__flow">
      <path className="sea-wave__back" fill="#ab9beb" opacity=".35" d="M45 328C163 342 190 256 257 185C328 106 457 98 510 164C557 221 513 276 472 256C501 230 479 191 443 195C358 206 397 325 590 343C441 409 172 395 45 328Z"/>
      <path className="sea-wave__body" fill={`url(#${id}-body)`} d="M34 339C168 343 231 289 261 204C288 125 340 67 421 66C494 65 552 116 540 171C532 210 493 222 466 201C500 207 515 163 488 144C449 116 402 150 407 202C414 268 477 315 601 340C482 393 169 411 34 339Z"/>
      <path className="sea-wave__crest" fill={`url(#${id}-crest)`} d="M236 263C275 175 283 83 388 61C482 40 560 103 540 171C532 195 516 210 491 208C535 187 515 126 474 117C425 101 379 129 367 170C369 112 416 90 456 94C359 61 306 143 282 213C267 251 252 271 236 263Z"/>
      <path className="sea-wave__front" fill={`url(#${id}-front)`} opacity=".8" d="M42 340C166 289 217 373 331 328C454 277 482 367 604 339C521 401 390 405 302 378C192 413 99 376 42 340Z"/>
      <g className="sea-wave__highlights" fill="none" stroke="#f6efff" strokeLinecap="round" opacity=".65"><path strokeWidth="3" d="M92 342C177 328 208 356 266 345M285 207C308 140 329 108 360 92M430 328C486 321 516 354 557 351"/><path strokeWidth="2" d="M386 76C438 60 485 84 503 107"/></g>
      <g className="sea-wave__eyes" fill="#38275e"><ellipse cx="341" cy="262" rx="3.5" ry="5"/><ellipse cx="375" cy="252" rx="3.5" ry="5"/></g>
    </g>
  </svg>;
}
