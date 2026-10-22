import { useMemo } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { TrendingUp, TrendingDown, Award, Percent, DollarSign, Activity, FileText } from "lucide-react";
import { Candlestick, IndicatorSettings, Trade, BacktestMetrics } from "../types";
import { computeAllIndicators } from "../lib/chartGenerator";

interface BacktestDashboardProps {
  candlesticks: Candlestick[];
  settings: IndicatorSettings;
  computedState: ReturnType<typeof computeAllIndicators>;
  asset: string;
}

export default function BacktestDashboard({
  candlesticks,
  settings,
  computedState,
  asset,
}: BacktestDashboardProps) {
  const { mlSignals, cvdMa } = computedState;

  // Run the historical backtest over the candle dataset
  const backtestData = useMemo(() => {
    const trades: Trade[] = [];
    const count = candlesticks.length;
    let initialBalance = 10000;
    let currentBalance = initialBalance;
    const equityCurve: { name: string; equity: number }[] = [{ name: "Старт", equity: initialBalance }];

    let activeTrade: Trade | null = null;
    let peakEquity = initialBalance;
    let maxDd = 0;

    // Simulate bar-by-bar progression
    for (let i = 50; i < count; i++) {
      const candle = candlesticks[i];
      const mlSignal = mlSignals[i];
      const cvd = candle.cvd;
      const maVal = cvdMa[i];

      // Check exit condition if a trade is currently open
      if (activeTrade) {
        const isBuy = activeTrade.type === 'BUY';
        
        // Simple Profit/Loss Target simulation
        // Take profit = 2% on crypto, 0.15% on forex
        // Stop loss = 1% on crypto, 0.08% on forex
        const targetMultiplier = asset === 'EUR/USD' ? 0.002 : 0.025;
        const slMultiplier = asset === 'EUR/USD' ? 0.001 : 0.012;

        const tpPrice = isBuy 
          ? activeTrade.entryPrice * (1 + targetMultiplier) 
          : activeTrade.entryPrice * (1 - targetMultiplier);
        const slPrice = isBuy 
          ? activeTrade.entryPrice * (1 - slMultiplier) 
          : activeTrade.entryPrice * (1 + slMultiplier);

        let triggerExit = false;
        let exitPrice = candle.close;
        let exitReason = "Выход по времени";

        if (isBuy) {
          if (candle.high >= tpPrice) {
            exitPrice = tpPrice;
            triggerExit = true;
            exitReason = "Take Profit (Целевой Тейк)";
          } else if (candle.low <= slPrice) {
            exitPrice = slPrice;
            triggerExit = true;
            exitReason = "Stop Loss (Защитный Стоп)";
          }
        } else {
          // Sell trade
          if (candle.low <= tpPrice) {
            exitPrice = tpPrice;
            triggerExit = true;
            exitReason = "Take Profit (Целевой Тейк)";
          } else if (candle.high >= slPrice) {
            exitPrice = slPrice;
            triggerExit = true;
            exitReason = "Stop Loss (Защитный Стоп)";
          }
        }

        // Force close on the last candle
        if (i === count - 1) {
          triggerExit = true;
          exitPrice = candle.close;
          exitReason = "Принудительное закрытие конца истории";
        }

        if (triggerExit) {
          const priceDiffPct = (exitPrice - activeTrade.entryPrice) / activeTrade.entryPrice;
          const tradeReturnPct = isBuy ? priceDiffPct : -priceDiffPct;
          
          // Assume 3x leverage on trading positions
          const leverage = asset === 'EUR/USD' ? 30 : 5;
          const netReturnPct = tradeReturnPct * leverage;
          const profitAmount = currentBalance * netReturnPct;

          currentBalance += profitAmount;
          activeTrade.status = 'CLOSED';
          activeTrade.exitIndex = i;
          activeTrade.exitPrice = exitPrice;
          activeTrade.exitTime = new Date(candle.time).toLocaleTimeString();
          activeTrade.profit = profitAmount;
          activeTrade.profitPct = netReturnPct * 100;
          activeTrade.reason = exitReason;

          trades.push({ ...activeTrade });
          equityCurve.push({
            name: `Сделка ${trades.length}`,
            equity: currentBalance
          });

          // Drawdown tracking
          if (currentBalance > peakEquity) {
            peakEquity = currentBalance;
          } else {
            const dd = ((peakEquity - currentBalance) / peakEquity) * 100;
            if (dd > maxDd) maxDd = dd;
          }

          activeTrade = null;
        }
      } else {
        // No active trade, look for entry triggers
        // BUY Trigger: ML signal is +1 (BUY) and CVD is above MA
        const isBuySignal = mlSignal === 1 && cvd > maVal;
        
        // SELL Trigger: ML signal is -1 (SELL) and CVD is below MA
        const isSellSignal = mlSignal === -1 && cvd < maVal;

        if (isBuySignal) {
          activeTrade = {
            id: `trade-${i}`,
            type: 'BUY',
            asset,
            entryIndex: i,
            exitIndex: 0,
            entryPrice: candle.close,
            exitPrice: 0,
            entryTime: new Date(candle.time).toLocaleTimeString(),
            exitTime: "",
            profit: 0,
            profitPct: 0,
            status: 'OPEN',
            reason: "Консенсус: ИИ ЛОНГ + Положительный CVD",
          };
        } else if (isSellSignal) {
          activeTrade = {
            id: `trade-${i}`,
            type: 'SELL',
            asset,
            entryIndex: i,
            exitIndex: 0,
            entryPrice: candle.close,
            exitPrice: 0,
            entryTime: new Date(candle.time).toLocaleTimeString(),
            exitTime: "",
            profit: 0,
            profitPct: 0,
            status: 'OPEN',
            reason: "Консенсус: ИИ ШОРТ + Отрицательный CVD",
          };
        }
      }
    }

    // Compute final backtest metrics
    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.profitPct > 0).length;
    const losingTrades = totalTrades - winningTrades;
    const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    let grossProfits = 0;
    let grossLosses = 0;
    trades.forEach((t) => {
      if (t.profit > 0) grossProfits += t.profit;
      else grossLosses += Math.abs(t.profit);
    });

    const profitFactor = grossLosses === 0 ? (grossProfits > 0 ? 9.99 : 1.0) : grossProfits / grossLosses;
    const netProfitPct = ((currentBalance - initialBalance) / initialBalance) * 100;

    const metrics: BacktestMetrics = {
      totalTrades,
      winningTrades,
      losingTrades,
      winRate,
      profitFactor,
      netProfitPct,
      maxDrawdown: maxDd,
      equityCurve,
    };

    return { metrics, trades };
  }, [candlesticks, mlSignals, cvdMa, asset]);

  const { metrics, trades } = backtestData;

  return (
    <div className="space-y-6" id="backtest-dashboard">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Net Profit card */}
        <div className="bg-[#0f121d] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">Чистая доходность</span>
            <span className={`text-xl font-bold tracking-tight block ${metrics.netProfitPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {metrics.netProfitPct >= 0 ? "+" : ""}{metrics.netProfitPct.toFixed(2)}%
            </span>
            <span className="text-[10px] text-gray-500 font-mono block">Кредитное плечо вшито</span>
          </div>
          <div className={`p-3 rounded-xl border ${
            metrics.netProfitPct >= 0 
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}>
            <DollarSign className="h-5 w-5" />
          </div>
        </div>

        {/* Win Rate card */}
        <div className="bg-[#0f121d] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">Винрейт (Win Rate)</span>
            <span className="text-xl font-bold text-white tracking-tight block">
              {metrics.winRate.toFixed(1)}%
            </span>
            <span className="text-[10px] text-gray-500 font-mono block">
              {metrics.winningTrades} W / {metrics.losingTrades} L
            </span>
          </div>
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400">
            <Award className="h-5 w-5" />
          </div>
        </div>

        {/* Profit Factor card */}
        <div className="bg-[#0f121d] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">Профит-фактор</span>
            <span className={`text-xl font-bold tracking-tight block ${metrics.profitFactor >= 1.5 ? "text-emerald-400" : "text-amber-400"}`}>
              {metrics.profitFactor.toFixed(2)}
            </span>
            <span className="text-[10px] text-gray-500 font-mono block">Отношение вал. прибыли к убытку</span>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        {/* Max Drawdown card */}
        <div className="bg-[#0f121d] rounded-2xl border border-gray-800 p-5 flex items-center justify-between shadow-lg">
          <div className="space-y-1">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider block">Макс. Просадка (DD)</span>
            <span className="text-xl font-bold text-rose-400 tracking-tight block">
              -{metrics.maxDrawdown.toFixed(2)}%
            </span>
            <span className="text-[10px] text-gray-500 font-mono block">Пиковый риск системы</span>
          </div>
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <Percent className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Equity Line chart */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Chart container */}
        <div className="xl:col-span-2 bg-[#0a0d16] border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-semibold text-white">Кривая доходности торговой сессии (Equity Curve)</h4>
              <p className="text-xs text-gray-400">Прогрессия симулированного баланса в $ (старт с $10,000)</p>
            </div>
            <div className="text-xs font-mono text-gray-500 flex items-center gap-1.5 bg-[#121624] px-2.5 py-1 rounded-lg border border-gray-800">
              <span className="w-2 h-2 rounded-full bg-blue-400 block"></span>
              Баланс портфеля
            </div>
          </div>

          <div className="h-64 w-full text-xs">
            {metrics.totalTrades === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-gray-500 italic">
                Ожидание первых сделок... Настройте адекватные индикаторы или запустите тики.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics.equityCurve} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(40, 50, 75, 0.15)" strokeDasharray="3 3" />
                  <XAxis dataKey="name" stroke="#64748b" />
                  <YAxis stroke="#64748b" domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#111827", borderColor: "#1f2937" }}
                    labelStyle={{ color: "#ffffff", fontWeight: "bold" }}
                    itemStyle={{ color: "#38bdf8" }}
                    formatter={(value: any) => [`$${Math.round(value)}`, "Баланс"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="equity"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 4, strokeWidth: 1 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Performance metrics breakdown */}
        <div className="bg-[#0f121d] border border-gray-800 rounded-2xl p-5 shadow-xl space-y-4">
          <h4 className="text-sm font-semibold text-white">Статистика стратегии</h4>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Общее число сделок:</span>
              <span className="font-bold text-white font-mono">{metrics.totalTrades}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Успешные сделки (Profit):</span>
              <span className="font-bold text-emerald-400 font-mono">{metrics.winningTrades}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Убыточные сделки (Loss):</span>
              <span className="font-bold text-rose-400 font-mono">{metrics.losingTrades}</span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Средняя доходность сделки:</span>
              <span className={`font-bold font-mono ${metrics.netProfitPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {(metrics.netProfitPct / (metrics.totalTrades || 1)).toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between border-b border-gray-800 pb-2">
              <span className="text-gray-400">Используемое плечо (Leverage):</span>
              <span className="font-bold text-white font-mono">{asset === 'EUR/USD' ? '30x (Forex)' : '5x (Crypto)'}</span>
            </div>
          </div>

          <div className="bg-gray-950/50 p-3.5 rounded-xl border border-gray-800 text-[11px] text-gray-400 leading-relaxed">
            <span className="font-bold text-gray-300 block mb-1">💡 Как улучшить винрейт?</span>
            Увеличьте значение <strong className="text-gray-200">K (ближайших соседей)</strong> и <strong className="text-gray-200">Порог схождения сигнала</strong>, чтобы ИИ входил только в самые уверенные паттерны схождения дельты.
          </div>
        </div>
      </div>

      {/* Trades History Table */}
      <div className="bg-[#0a0d16] border border-gray-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-400" />
          <h4 className="text-sm font-semibold text-white">Журнал закрытых сделок (Trades Log)</h4>
        </div>

        <div className="overflow-x-auto">
          {trades.length === 0 ? (
            <div className="p-8 text-center text-gray-500 italic text-xs">
              Сделок еще не было. Запустите эмуляцию или нажмите Pump/Dump для симуляции волатильности.
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-4">Тип</th>
                  <th className="py-3 px-4">Вход $</th>
                  <th className="py-3 px-4">Выход $</th>
                  <th className="py-3 px-4">Доход %</th>
                  <th className="py-3 px-4">Прибыль $</th>
                  <th className="py-3 px-4">Время входа / выхода</th>
                  <th className="py-3 px-4">Причина выхода</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {trades.slice().reverse().map((trade) => {
                  const isWin = trade.profitPct > 0;
                  return (
                    <tr key={trade.id} className="hover:bg-gray-900/30 transition-all">
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                          trade.type === 'BUY' 
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                        }`}>
                          {trade.type === 'BUY' ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                          {trade.type === 'BUY' ? 'LONG (ПОКУПКА)' : 'SHORT (ПРОДАЖА)'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-gray-300">
                        {trade.entryPrice.toFixed(asset === 'EUR/USD' ? 4 : 2)}
                      </td>
                      <td className="py-3 px-4 font-mono font-medium text-gray-300">
                        {trade.exitPrice.toFixed(asset === 'EUR/USD' ? 4 : 2)}
                      </td>
                      <td className={`py-3 px-4 font-mono font-bold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                        {isWin ? "+" : ""}{trade.profitPct.toFixed(2)}%
                      </td>
                      <td className={`py-3 px-4 font-mono font-bold ${isWin ? "text-emerald-400" : "text-rose-400"}`}>
                        {isWin ? "+" : ""}${Math.round(trade.profit)}
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-[10px]">
                        <div>Вход: {trade.entryTime}</div>
                        <div>Выход: {trade.exitTime}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-[10px]">
                        {trade.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
