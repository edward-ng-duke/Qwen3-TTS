# 克隆参考音色库（给 base 变体用）

base 变体**没有内置音色**，声音由参考音频决定。这里收录了 customvoice 的 9 个内置说话人片段，
可直接当 `/v1/clone`（或 `/v1/voice/save`）的**参考音频**。

> **ICL 模式（`x_vector_only=false`，保真最高）必须传 `ref_text`** —— 就是下表「文字稿」那一列，
> 它是这条参考音频里**逐字说的内容**，别填错。不想填就用 `x_vector_only=true`（略逊）。

| 文件 | 说话人 | 性别/年龄 | 语言 | `ref_text`（文字稿，逐字） |
|---|---|---|---|---|
| `vivian_中文女_成人_今天天气真好.wav` | Vivian | 女/成人 | 中文 | `今天天气真好，我们一起出去走走吧。` |
| `uncle_fu_中文男_老年_听我讲个老故事.wav` | Uncle Fu | 男/老年 | 中文 | `孩子，听我给你讲一个老故事。` |
| `ryan_英文男_成人.wav` | Ryan | 男/成人 | 英文 | `Hello, this is a quick voice preview.` |
| `serena_英文女_年轻.wav` | Serena | 女/年轻 | 英文 | `Lovely to meet you. Shall we begin?` |
| `aiden_英文男_年轻.wav` | Aiden | 男/年轻 | 英文 | `Hey, ready to crush today? Let's go!` |
| `dylan_英文男_成人英腔.wav` | Dylan | 男/成人 | 英文 | `So, where shall we start the story today?` |
| `ono_anna_日文女_成人.wav` | Ono Anna | 女/成人 | 日文 | `こんにちは、よろしくお願いします。` |
| `sohee_韩文女_年轻.wav` | Sohee | 女/年轻 | 韩文 | `안녕하세요, 만나서 반가워요.` |
| `eric_德文男_成人.wav` | Eric | 男/成人 | 德文 | `Guten Tag, schön, Sie kennenzulernen.` |

## 用法（以 uncle_fu 为例）
```bash
curl --noproxy '*' -s http://127.0.0.1:4970/v1/clone \
  -F text="今天我们来讲讲那座山里的传说。" \
  -F ref_audio=@00_克隆参考音色库/uncle_fu_中文男_老年_听我讲个老故事.wav \
  -F ref_text="孩子，听我给你讲一个老故事。" \
  -F x_vector_only=false -F language=Chinese -F seed=2024 \
  -o out.wav
```

## 提醒
- 这些片段较短（2.3–3.9s）。**参考音频越长越干净，克隆越像**（建议 4–8s）。需要的话可以从
  customvoice 服务为每个说话人重新生成更长的参考句。
- 想要"你自己的声音"：把参考换成你的一段干净录音（5–15s）+ 对应文字稿即可。
- 这些参考是 customvoice **合成**的，不是真人；作为克隆源完全够用（本目录上层 05/06 就是用它们克隆的）。
