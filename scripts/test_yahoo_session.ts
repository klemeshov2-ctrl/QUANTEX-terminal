import { getYahooFinanceSession } from "../server/gexEngine.js";

async function testYahoo() {
  console.log("Testing Yahoo getYahooFinanceSession...");
  const t0 = Date.now();
  const session = await getYahooFinanceSession();
  console.log(`Session:`, session ? { crumb: session.crumb, cookieLen: session.cookie.length } : null, `in ${Date.now() - t0}ms`);
  if (session) {
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/options/GLD?crumb=${encodeURIComponent(session.crumb)}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Cookie: session.cookie
      }
    });
    console.log(`GLD with crumb status: ${res.status} ${res.statusText}`);
    if (res.ok) {
      const j = await res.json();
      const r = j.optionChain?.result?.[0];
      console.log(`Quote price: ${r?.quote?.regularMarketPrice}, marketTime: ${r?.quote?.regularMarketTime}`);
      console.log(`Expirations: ${r?.expirationDates?.length}`);
    }
  }
}

testYahoo();
