import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css'

function App() {
  const navigate = useNavigate();
  const [time, setTime] = useState('00:00');
  const [coins, setCoins] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [score, setScore] = useState(false);
  const [coin, setCoin] = useState(true);
  const [exp, setExp] = useState(false);
  const [timeItem, setTimeItem] = useState(false);
  const [bomb, setBomb] = useState(false);
  const [fivetofour, setFivetofour] = useState(true);
  const [character, setCharacter] = useState('');
  const [skill, setSkill] = useState(1);
  const [entries, setEntries] = useState<Array<{character: string; skill: number; cpm: number; ts: number}>>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const handleCalcClick = () => {
    const timeParts = time.split(':');
    const minutes = Number(timeParts[0]);
    const seconds = Number(timeParts[1]);
    const totalMinutes = minutes + (seconds / 60);
    let lastCoins = coins;

    if(coin) lastCoins = lastCoins * 1.3;

    if (score) lastCoins -=500;
    if (coin) lastCoins -=500;
    if (exp) lastCoins -=500;
    if (timeItem) lastCoins -=1000;
    if (bomb) lastCoins -=1500;
    if (fivetofour) lastCoins -=1800;

    setResult( lastCoins / totalMinutes);
  }

  // Load saved entries from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('cpm_entries');
      if (raw) setEntries(JSON.parse(raw));
    } catch (e) {
      console.error('failed to load entries', e);
    }
  }, []);

  // no-op: removed Firebase auth/server sync — app now uses only localStorage + JSON import/export

  // aggregated ranking (character+skill) for reuse in UI
  const aggregated = (() => {
    const map = new Map<string, {character: string; skill: number; sum: number; count: number}>();
    entries.forEach(e => {
      const key = `${e.character}::${e.skill}`;
      const cur = map.get(key);
      if (cur) {
        cur.sum += e.cpm;
        cur.count += 1;
      } else {
        map.set(key, { character: e.character, skill: e.skill, sum: e.cpm, count: 1 });
      }
    });
    const arr = Array.from(map.values()).map(v => ({
      character: v.character,
      skill: v.skill,
      avg: v.sum / v.count,
      count: v.count,
    }));
    arr.sort((a, b) => b.avg - a.avg);
    return arr;
  })();

  function saveEntriesToStorage(next: typeof entries) {
    try {
      localStorage.setItem('cpm_entries', JSON.stringify(next));
    } catch (e) {
      console.error('failed to save entries', e);
    }
  }

  const handleDeleteEntry = (ts: number) => {
    if (!window.confirm('この保存エントリを削除しますか？')) return;
    const next = entries.filter(e => e.ts !== ts);
    setEntries(next);
    saveEntriesToStorage(next);
  }

  const handleSave = () => {
    if (!character.trim()) {
      window.alert('キャラクター名を入力してください');
      return;
    }
    if (result == null || Number.isNaN(result)) {
      window.alert('まず計算をしてください');
      return;
    }
    const entry = { character: character.trim(), skill, cpm: result, ts: Date.now() };
    const next = [entry, ...entries];
    setEntries(next);
    saveEntriesToStorage(next);
  }


  // Export entries as JSON file
  const handleExportJSON = () => {
    try {
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cpm_entries_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('export failed', e);
      window.alert('エクスポートに失敗しました');
    }
  }

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImportClick = () => {
    setImportError(null);
    fileInputRef.current?.click();
  }

  const handleFileChange = async (e: any) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error('JSONは配列である必要があります');
      // validate items and normalize
      const items: Array<{character:string; skill:number; cpm:number; ts:number}> = [];
      parsed.forEach((it: any) => {
        if (!it || typeof it !== 'object') return;
        const character = String(it.character || '');
        const skill = Number(it.skill || 1);
        const cpm = Number(it.cpm || 0);
        const ts = Number(it.ts || Date.now());
        items.push({ character, skill, cpm, ts });
      });
      // merge by ts (import overwrites local duplicates)
      const map = new Map<number, {character:string; skill:number; cpm:number; ts:number}>();
      entries.forEach(e => map.set(e.ts, e));
      items.forEach(i => map.set(i.ts, i));
      const merged = Array.from(map.values()).sort((a,b) => b.ts - a.ts);
      setEntries(merged);
      saveEntriesToStorage(merged);
      setImportError(null);
      window.alert('インポート完了');
    } catch (err: any) {
      console.error('import failed', err);
      setImportError(err?.message || String(err));
      window.alert('インポートに失敗しました：' + (err?.message || err));
    } finally {
      // clear input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }


  function handleApply(stopwatchTime: string) {
    setTime(stopwatchTime);
  }

  return (
    <>
      <h1>一分効率計算機</h1>
      <nav style={{ marginBottom: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => navigate('/usage')}>使い方</button>
      </nav>
      <div style={{ border: '1px solid #ddd', padding: 8, marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleExportJSON}>保存データをJSONでダウンロード</button>
          <button onClick={handleImportClick}>JSONをインポート</button>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleFileChange} />
          <div style={{ marginLeft: 'auto' }}>ローカル保存数: {entries.length}</div>
        </div>
        {importError && <div style={{ color: 'red', marginTop: 6 }}>インポートエラー: {importError}</div>}
      </div>
      <Stopwatch onApply={handleApply} />
      <div className="input-area">
        <p>
          <label>キャラクター：</label>
          <input type='text' value={character} onChange={e => setCharacter(e.target.value)}></input>
          <label>　スキルレベル：</label>
          <input type='number' value={skill} onChange={e => setSkill(Number(e.target.value))} min={1} max={6}></input>
        </p>
        <p>
          <label>時間（mm:ss）：</label>
          <input type='text' value={time} onChange={e => setTime(e.target.value)} pattern='^\d{2}:\d{2}$'></input>
        </p>
        <p>
          <label>素コイン：</label>
          <input type='text' value={coins} onChange={e => setCoins(Number(e.target.value))}></input>
        </p>
        <p>
          アイテム
        </p>
        <p>
          <label>スコア：</label>
          <input type='checkbox' checked={score} onChange={e => setScore(e.target.checked)}></input>
          <label>　コイン：</label>
          <input type='checkbox' checked={coin} onChange={e => setCoin(e.target.checked)}></input>
          <label>　EXP：</label>
          <input type='checkbox' checked={exp} onChange={e => setExp(e.target.checked)}></input>
          <label>　タイム：</label>
          <input type='checkbox' checked={timeItem} onChange={e => setTimeItem(e.target.checked)}></input>
          <label>　ボム：</label>
          <input type='checkbox' checked={bomb} onChange={e => setBomb(e.target.checked)}></input>
          <label>　5→4：</label>
          <input type='checkbox' checked={fivetofour} onChange={e => setFivetofour(e.target.checked)}></input>
        </p>
        <button onClick={handleCalcClick}>計算</button>
      </div>

      <div className="result-area">
        {result !== null &&
        <>
          <h2>結果</h2>
          <p>一分効率：{result !== null ? result : '???'}コイン/分</p>
          <p>一時間効率：{result !== null ? result * 60 : '???'}コイン/時</p>
          <p><button onClick={handleSave}>保存</button></p>
        </>
        }
      </div>

      <div className="ranking-area">
        <h2>ランキング（キャラ・スキル別：平均 一分効率）</h2>
        {entries.length === 0 ? (
          <p>保存データがありません</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>順位</th>
                <th>キャラクター</th>
                <th>スキル</th>
                <th>平均(コイン/分)</th>
                <th>件数</th>
              </tr>
            </thead>
            <tbody>
              {aggregated.map((r, i) => (
                <tr key={`${r.character}-${r.skill}`} onClick={() => { setCharacter(r.character); setSkill(r.skill); }} style={{ cursor: 'pointer' }}>
                  <td>{i+1}</td>
                  <td>{r.character}</td>
                  <td>{r.skill}</td>
                  <td>{r.avg.toFixed(2)}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="saved-list-area">
        <h2>保存一覧</h2>
        {isOpening && 
        <button onClick={() => setIsOpening(false)}>閉じる</button>
        }
        {!isOpening && 
        <button onClick={() => setIsOpening(true)}>開く</button>
        }
        { isOpening && (
        entries.length === 0 ? (
          <p>保存データがありません</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>キャラクター</th>
                <th>スキル</th>
                <th>一分効率</th>
                <th>日時</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.ts}>
                  <td>{e.character}</td>
                  <td>{e.skill}</td>
                  <td>{Number(e.cpm).toFixed(2)}</td>
                  <td>{new Date(e.ts).toLocaleString()}</td>
                  <td><button onClick={() => handleDeleteEntry(e.ts)}>削除</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </>
  )
}




function Stopwatch({ onApply }: { onApply: (time: string) => void }) {
    const [time, setTime] = useState(0);
    const [isRunning, setIsRunning] = useState(false);
    const intervalRef = useRef<number | null>(null);
    const startRef = useRef<number | null>(null); // performance.now() を保持
    const accRef = useRef<number>(0); // 一時停止時の累積ミリ秒

    function handleStart() {
        if (isRunning) return;
        setIsRunning(true);
        startRef.current = performance.now();
        // 更新頻度は30ms程度で十分。実時間は performance.now() で計算するので精度良好。
        intervalRef.current = window.setInterval(() => {
            const now = performance.now();
            const elapsed = accRef.current + (startRef.current ? now - startRef.current : 0);
            setTime(Math.floor(elapsed));
        }, 30);
    }

    function handlePause() {
        if (!isRunning) return;
        const now = performance.now();
        if (startRef.current != null) {
            accRef.current += now - startRef.current;
        }
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        startRef.current = null;
        setIsRunning(false);
    }

    function handleReset() {
        if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        startRef.current = null;
        accRef.current = 0;
        setIsRunning(false);
        setTime(0);
    }

    

    const seconds = `0${Math.floor(time / 1000) % 60}`.slice(-2);
    const minutes = `0${Math.floor(time / 60000) % 60}`.slice(-2);

    return (
        <div>
            <h2>{minutes}:{seconds}</h2>
            {isRunning ? (
                <button onClick={handlePause}>Pause</button>
            ) : (
                <button onClick={handleStart}>Start</button>
            )}
            <button onClick={handleReset}>Reset</button>
            <button onClick={() => onApply(`${minutes}:${seconds}`)}>適用</button>
        </div>
    );
}


export default App
