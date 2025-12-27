
import { useNavigate } from 'react-router-dom'

export default function Usage() {
  const navigate = useNavigate()
  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <button onClick={() => navigate('/')}>ホームへ戻る</button>
      </div>
      <h1>使い方</h1>
      <p>このアプリは「一分あたりのコイン効率 (CPM)」を計算するツールです。基本的な使い方：</p>
      <ul>
        <li>キャラクター名とスキルレベルを入力します。</li>
        <li>プレイ開始と同時にストップウォッチを開始します。</li>
        <li>プレイ終了時にストップウォッチを停止し、適用を押します。</li>
        <li>素コイン数を入力します。</li>
        <li>アイテムの有無をチェックして、<strong>計算</strong>を押します。</li>
        <li>計算結果は画面に表示され、保存ボタンでローカルに保存できます。</li>
      </ul>
      <p>保存したデータはJSONでエクスポート／インポート可能です。</p>
    </div>
  )
}
