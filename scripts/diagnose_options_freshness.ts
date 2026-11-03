import { parseOptionChainTimestampMs, isOptionTimestampStale } from "../server/gexEngine.js";

async function diagnose() {
  console.log("=== DIAGNOSTICS: XAUUSD OPTION CASCADE SOURCES ===");
  const now = Date.now();
  console.log(`Current system time: ${new Date(now).toISOString()} (${now} ms)`);
  console.log(`Current MSK time: ${new Date(now + 3 * 3600 * 1000).toISOString().replace("Z", "+03:00")}`);

  // 1. CBOE CDN GLD.json
  console.log("\n--- [1] CBOE CDN GLD.json ---");
  const t0 = Date.now();
  try {
    const res = await fetch("https://cdn.cboe.com/api/global/delayed_quotes/options/GLD.json", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(8000)
    });
    const lat = Date.now() - t0;
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${lat}ms)`);
    if (res.ok) {
      const json = await res.json();
      console.log(`json.timestamp: ${JSON.stringify(json.timestamp)} (type: ${typeof json.timestamp})`);
      console.log(`json.data?.timestamp: ${JSON.stringify(json.data?.timestamp)}`);
      console.log(`json.data?.last_trade_time: ${JSON.stringify(json.data?.last_trade_time)}`);
      const sampleOption = json.data?.options?.[0];
      console.log(`sample option[0].last_trade_time: ${JSON.stringify(sampleOption?.last_trade_time)}`);
      console.log(`total options count: ${json.data?.options?.length}`);

      const rawFeedTs = json.timestamp || json.data?.timestamp || json.data?.last_trade_time || sampleOption?.last_trade_time || null;
      const parsedMs = parseOptionChainTimestampMs(rawFeedTs);
      const ageMin = parsedMs ? ((now - parsedMs) / (60 * 1000)).toFixed(1) : "N/A";
      console.log(`Raw feed timestamp used: ${rawFeedTs}`);
      console.log(`Parsed dataTimestampMs: ${parsedMs} (${parsedMs ? new Date(parsedMs).toISOString() : "null"})`);
      console.log(`Calculated Age: ${ageMin} minutes (${(Number(ageMin) / 60).toFixed(2)} hours)`);
      console.log(`isOptionTimestampStale (1h limit): ${isOptionTimestampStale(parsedMs, now)}`);
    }
  } catch (e: any) {
    console.log(`CBOE CDN fetch failed: ${e.message}`);
  }

  // 2. Yahoo Finance GC=F options
  console.log("\n--- [2] Yahoo Finance GC=F options ---");
  const t1 = Date.now();
  try {
    const res = await fetch("https://query2.finance.yahoo.com/v7/finance/options/GC=F", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(8000)
    });
    const lat = Date.now() - t1;
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${lat}ms)`);
    if (res.ok) {
      const json = await res.json();
      const result = json.optionChain?.result?.[0];
      console.log(`quote.regularMarketTime: ${result?.quote?.regularMarketTime}`);
      const calls = result?.options?.[0]?.calls || [];
      const puts = result?.options?.[0]?.puts || [];
      console.log(`Calls count: ${calls.length}, Puts count: ${puts.length}`);
      const maxTrade = Math.max(...calls.concat(puts).map((o: any) => o.lastTradeDate || 0), 0);
      console.log(`Max option lastTradeDate (sec): ${maxTrade} (${maxTrade ? new Date(maxTrade * 1000).toISOString() : "none"})`);
      const ageMin = maxTrade ? ((now - maxTrade * 1000) / (60 * 1000)).toFixed(1) : "N/A";
      console.log(`Calculated Age: ${ageMin} minutes (${(Number(ageMin) / 60).toFixed(2)} hours)`);
    } else {
      const txt = await res.text();
      console.log(`Response body preview: ${txt.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`Yahoo GC=F fetch failed: ${e.message}`);
  }

  // 3. Yahoo Finance GLD options
  console.log("\n--- [3] Yahoo Finance GLD options ---");
  const t2 = Date.now();
  try {
    const res = await fetch("https://query2.finance.yahoo.com/v7/finance/options/GLD", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
      },
      signal: AbortSignal.timeout(8000)
    });
    const lat = Date.now() - t2;
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${lat}ms)`);
    if (res.ok) {
      const json = await res.json();
      const result = json.optionChain?.result?.[0];
      console.log(`quote.regularMarketTime: ${result?.quote?.regularMarketTime}`);
      const calls = result?.options?.[0]?.calls || [];
      const puts = result?.options?.[0]?.puts || [];
      console.log(`Calls count: ${calls.length}, Puts count: ${puts.length}`);
      const maxTrade = Math.max(...calls.concat(puts).map((o: any) => o.lastTradeDate || 0), 0);
      console.log(`Max option lastTradeDate (sec): ${maxTrade} (${maxTrade ? new Date(maxTrade * 1000).toISOString() : "none"})`);
      const ageMin = maxTrade ? ((now - maxTrade * 1000) / (60 * 1000)).toFixed(1) : "N/A";
      console.log(`Calculated Age: ${ageMin} minutes (${(Number(ageMin) / 60).toFixed(2)} hours)`);
    } else {
      const txt = await res.text();
      console.log(`Response body preview: ${txt.slice(0, 200)}`);
    }
  } catch (e: any) {
    console.log(`Yahoo GLD fetch failed: ${e.message}`);
  }

  // 4. Deribit PAXG_USDC
  console.log("\n--- [4] Deribit PAXG_USDC ---");
  const t3 = Date.now();
  try {
    const res = await fetch("https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=USDC&kind=option", {
      signal: AbortSignal.timeout(6000)
    });
    const lat = Date.now() - t3;
    console.log(`HTTP Status: ${res.status} ${res.statusText} (${lat}ms)`);
    if (res.ok) {
      const json = await res.json();
      const allItems: any[] = Array.isArray(json?.result) ? json.result : [];
      const goldItems = allItems.filter(item => {
        const inst = String(item?.instrument_name || "").toUpperCase();
        return inst.startsWith("PAXG_USDC-") || inst.startsWith("PAXG-") || inst.startsWith("XAU");
      });
      console.log(`Total USDC option instruments: ${allItems.length}, Gold/PAXG instruments: ${goldItems.length}`);
      const maxCreationTs = Math.max(...goldItems.map(i => Number(i.creation_timestamp) || 0), 0);
      console.log(`Max creation_timestamp (ms): ${maxCreationTs} (${maxCreationTs ? new Date(maxCreationTs).toISOString() : "none"})`);
      if (maxCreationTs > 0) {
        const ageMin = ((now - maxCreationTs) / (60 * 1000)).toFixed(1);
        console.log(`Calculated Age: ${ageMin} minutes (${(Number(ageMin) / 60).toFixed(2)} hours)`);
      }
    }
  } catch (e: any) {
    console.log(`Deribit fetch failed: ${e.message}`);
  }
}

diagnose();
