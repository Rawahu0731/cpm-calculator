import { useState, useRef, useEffect } from 'react';
import type { User } from 'firebase/auth';
import { auth, signInWithEmail, signUpWithEmail, signOutUser, onAuthStateChanged, uploadEntriesForUser, fetchEntriesForUser, deleteEntryForUser, clearEntriesForUser } from './firebase';
import './App.css'

function App() {
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [user, setUser] = useState<any>(null);
  const [isOpening, setIsOpening] = useState(false);

  const handleCalcClick = () => {
    const timeParts = time.split(':');
    const minutes = Number(timeParts[0]);
    const seconds = Number(timeParts[1]);
    const totalMinutes = minutes + (seconds / 60);
    let lastCoins = coins;

    if (score) lastCoins -=500;
    if (coin) lastCoins -=500;
    if (exp) lastCoins -=500;
    if (timeItem) lastCoins -=1000;
    if (bomb) lastCoins -=1500;
    if (fivetofour) lastCoins -=1800;

    setResult( lastCoins / totalMinutes);
    if (coin) setResult( lastCoins * 1.3 / totalMinutes);
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

  // Firebase auth state listener — ログイン時にサーバーデータを取得してローカルとマージ
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u: User | null) => {
      setUser(u ?? null);
      if (u) {
        (async () => {
          try {
            const serverEntries = await fetchEntriesForUser(u);
            // ローカルの保存データを取得してマージ（tsで一意化）
            let local: Array<{character:string; skill:number; cpm:number; ts:number}> = [];
            try {
              const raw = localStorage.getItem('cpm_entries');
              if (raw) local = JSON.parse(raw);
            } catch (e) { console.error('failed to parse local entries', e); }

            const map = new Map<number, {character:string; skill:number; cpm:number; ts:number}>();
            // server優先で同tsのものは上書きされる
            serverEntries.forEach((e) => map.set(e.ts, e));
            local.forEach((e) => { if (!map.has(e.ts)) map.set(e.ts, e); });
            const merged = Array.from(map.values()).sort((a,b) => b.ts - a.ts);
            setEntries(merged);
            try { localStorage.setItem('cpm_entries', JSON.stringify(merged)); } catch (e) { console.error('failed to save merged entries', e); }
          } catch (err) {
            console.error('failed to fetch server entries', err);
          }
        })();
      }
    });
    return () => unsubscribe();
  }, []);

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

  const handleDeleteEntry = async (ts: number) => {
    if (!window.confirm('この保存エントリを削除しますか？')) return;
    // If logged in, delete from server as well
    if (user) {
      try {
        await deleteEntryForUser(user, ts);
      } catch (e) {
        console.error('failed to delete server entry', e);
        window.alert('サーバー上の削除に失敗しました：' + (e as any)?.message);
        return;
      }
    }
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

  // Authentication handlers
  const handleSignUp = async () => {
    try {
      await signUpWithEmail(email, password);
      window.alert('サインアップ成功。ログインしてください。');
    } catch (e: any) {
      console.error(e);
      window.alert('サインアップ失敗：' + (e?.message || e));
    }
  }

  const handleSignIn = async () => {
    try {
      const cred = await signInWithEmail(email, password);
      const u = cred.user;
      setUser(u);
      // Upload local entries to Firestore after sign in
      if (entries.length > 0) {
        try {
          await uploadEntriesForUser(u, entries);
          if (window.confirm('ローカルの保存データをFirestoreにアップロードしました。ローカルのデータを削除しますか？')) {
            setEntries([]);
            localStorage.removeItem('cpm_entries');
          }
        } catch (err) {
          console.error('upload failed', err);
          window.alert('アップロードに失敗しました：' + (err as any)?.message);
        }
      }
    } catch (e: any) {
      console.error(e);
      window.alert('サインイン失敗：' + (e?.message || e));
    }
  }

  const handleSignOut = async () => {
    try {
      await signOutUser();
      setUser(null);
    } catch (e) {
      console.error(e);
    }
  }

  const handleClearAll = async () => {
    if (!window.confirm('保存データを全て削除しますか？')) return;
    // If logged in, clear server data first
    if (user) {
      try {
        await clearEntriesForUser(user);
      } catch (e) {
        console.error('failed to clear server entries', e);
        window.alert('サーバー上の削除に失敗しました：' + (e as any)?.message);
        return;
      }
    }
    setEntries([]);
    localStorage.removeItem('cpm_entries');
  }

  function handleApply(stopwatchTime: string) {
    setTime(stopwatchTime);
  }

  return (
    <>
      <h1>一分効率計算機</h1>
      <div style={{ border: '1px solid #ddd', padding: 8, marginBottom: 12 }}>
        {user ? (
          <div>
            <div>ログイン中: {user.email}</div>
            <button onClick={handleSignOut}>サインアウト</button>
            <button onClick={async () => {
              try {
                await uploadEntriesForUser(user, entries);
                window.alert('アップロード完了');
              } catch (e: any) {
                console.error(e);
                window.alert('アップロード失敗：' + (e?.message || e));
              }
            }}>Firestoreにアップロード</button>
          </div>
        ) : (
          <div>
            <input placeholder='email' value={email} onChange={e => setEmail(e.target.value)} />
            <input placeholder='password' type='password' value={password} onChange={e => setPassword(e.target.value)} />
            <button onClick={handleSignIn}>サインイン</button>
            <button onClick={handleSignUp}>サインアップ</button>
          </div>
        )}
        <div style={{ marginTop: 6 }}>ローカル保存数: {entries.length}</div>
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
          <p><button onClick={handleSave}>保存</button> <button onClick={handleClearAll}>全削除</button></p>
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
