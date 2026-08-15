const fs = require('fs');
let code = fs.readFileSync('src/components/ForYouDashboard.tsx', 'utf-8');

const watchlistJSX = `
      {/* 4. WATCHLIST INTELLIGENCE */}
      {watchlistIntelligence.length > 0 && watchlistIntelligence[0].importantNews && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-display font-bold text-lg text-white flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-400" />
              Your Watchlist Intelligence
            </h3>
            <span className="text-xs text-slate-400">AI Synthesized</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Price Movements */}
            {watchlistIntelligence[0].priceMovements?.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl flex flex-col gap-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Price Movements</span>
                <div className="flex flex-col gap-2">
                  {watchlistIntelligence[0].priceMovements.map((move: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm text-white">{move.symbol}</span>
                        <span className={\`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded \${move.trend === 'up' ? 'bg-emerald-500/20 text-emerald-400' : move.trend === 'down' ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-slate-300'}\`}>
                          {move.trend}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">{move.analysis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Important News */}
            {watchlistIntelligence[0].importantNews?.length > 0 && (
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl flex flex-col gap-3">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Important News</span>
                <div className="flex flex-col gap-3">
                  {watchlistIntelligence[0].importantNews.map((news: any, i: number) => (
                    <div key={i} className="flex flex-col gap-1">
                      <span className="font-bold text-sm text-white">{news.title}</span>
                      <p className="text-xs text-slate-400 line-clamp-2">{news.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sector Impact & Peer Comparison */}
            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {watchlistIntelligence[0].sectorImpact?.length > 0 && (
                <div className="bg-indigo-950/10 border border-indigo-900/20 p-5 rounded-3xl flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Sector Impact</span>
                  <div className="flex flex-col gap-2">
                    {watchlistIntelligence[0].sectorImpact.map((sector: any, i: number) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-white">{sector.sector}</span>
                        <p className="text-xs text-indigo-200">{sector.impact}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {watchlistIntelligence[0].peerComparison?.length > 0 && (
                <div className="bg-amber-950/10 border border-amber-900/20 p-5 rounded-3xl flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Peer Comparison</span>
                  <div className="flex flex-col gap-2">
                    {watchlistIntelligence[0].peerComparison.map((peer: any, i: number) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-white">{peer.symbol}</span>
                        <p className="text-xs text-amber-200">{peer.insight}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
`;

code = code.replace(/\{\/\* 4\. WATCHLIST INTELLIGENCE \*\/\}[\s\S]*?\{\/\* 5 & 6\. OPPORTUNITIES & RISKS \*\/\}/, watchlistJSX.trim() + '\n\n      {/* 5 & 6. OPPORTUNITIES & RISKS */}');
fs.writeFileSync('src/components/ForYouDashboard.tsx', code);
