// Golden test cases for the tokyo-kitan eval harness.
// Each entry mirrors the exact message that generate() in public/js/game.js would send.
// Message-building logic: game.js lines 219–231.
module.exports = [
  {
    slug: 'opener',
    label: 'Scene 1 opener',
    messages: [
      {
        role: 'user',
        content: 'Scene 1 of ~12. Begin — the player just arrived in Tokyo. Establish the mystery hook.\nDifficulty: standard'
      }
    ]
  },
  {
    slug: 'choice_follow',
    label: 'Scene 3 choice continuation',
    messages: [
      {
        role: 'user',
        content: 'Scene 3 of ~12. Player chose: "改札口で立ち止まり、声をかけた女性を追う". Continue.\nMystery state: A woman in a blue raincoat placed an unlabeled notebook near the payphone at Tokyo Station. She knew the player\'s name before any introductions.\nDifficulty: standard\nRecent history:\nScene 1 (東京駅): 改札口で立ち止まり、声をかけた女性を追う\nScene 2 (暗い路地): 女性の後ろ姿を確認する'
      }
    ]
  },
  {
    slug: 'typed_answer',
    label: 'Evaluate a typed answer',
    messages: [
      {
        role: 'user',
        content: 'Scene 4 of ~12. The player TYPED this answer to the NPC\'s question: "おばあさんからきいたです". Evaluate it (feedback field), then continue incorporating their answer.\nMystery state: The old shopkeeper asked how the player knew to come to this alley. He seems afraid of something.\nDifficulty: standard\nRecent history:\nScene 1 (東京駅): 改札口で立ち止まり、声をかけた女性を追う\nScene 2 (暗い路地): 女性の後ろ姿を確認する\nScene 3 (古い煙草屋): おじいさんに話しかける'
      }
    ]
  },
  {
    slug: 'dungeon_room',
    label: 'Dungeon room entry',
    messages: [
      {
        role: 'user',
        content: 'Scene 2 of ~12. The player enters 東京駅コンコース. Generate a scene set specifically in this location — describe the space, introduce an NPC or clue, deepen the mystery.\nAlready visited this dungeon run: 駅の出口 — NPCs and clues in this room may reference those locations.\nDifficulty: standard'
      }
    ]
  },
  {
    slug: 'quiet_moment',
    label: 'Mundane mid-game scene',
    messages: [
      {
        role: 'user',
        content: 'Scene 5 of ~12. Player chose: "古い本屋に入ってみる". Continue.\nMystery state: The player found a torn receipt with a locker number inside the notebook. The woman in blue has not reappeared since Scene 2. The old shopkeeper seemed afraid when he heard her description.\nDifficulty: standard\nRecent history:\nScene 2 (暗い路地): 女性の後ろ姿を確認する\nScene 3 (古い煙草屋): おじいさんに話しかける\nScene 4 (駅のロッカー): ロッカー番号を試してみる'
      }
    ]
  },
  {
    slug: 'tense_encounter',
    label: 'High-stakes confrontation',
    messages: [
      {
        role: 'user',
        content: 'Scene 7 of ~12. Player chose: "男の後をつけた". Continue.\nMystery state: A man in a grey suit has been following the player since Scene 4. He works for someone who knew the player\'s deceased grandmother. The notebook contains a partial map of underground passages. The old shopkeeper is now too frightened to speak.\nInventory: 古いノート、コインロッカーの鍵\nDifficulty: harder\nRecent history:\nScene 4 (駅のロッカー): ロッカー番号を試してみる\nScene 5 (古い本屋): 本棚の裏を確かめる\nScene 6 (神社の境内): 謎の男に声をかける'
      }
    ]
  },
  {
    slug: 'with_inventory',
    label: 'Inventory item used in scene',
    messages: [
      {
        role: 'user',
        content: 'Scene 6 of ~12. Player chose: "鍵を使って扉を開ける". Continue.\nMystery state: The player unlocked a back room at the shrine. The woman in blue left a second message inside the notebook — it names a location the player hasn\'t visited yet. The notebook and key came from the same locker.\nInventory: 古いノート、コインロッカーの鍵\nDifficulty: standard\nRecent history:\nScene 3 (古い煙草屋): おじいさんに話しかける\nScene 4 (駅のロッカー): ロッカー番号を試してみる\nScene 5 (古い本屋): 本棚の裏を確かめる'
      }
    ]
  },
  {
    slug: 'harder_difficulty',
    label: 'Harder difficulty signal',
    messages: [
      {
        role: 'user',
        content: 'Scene 4 of ~12. Player chose: "階段を降りて音の方へ向かう". Continue.\nMystery state: Faint music from a staircase led to a basement bar that isn\'t on any map. The bartender knew the player\'s grandmother. The woman in blue has not appeared yet.\nDifficulty: harder\nRecent history:\nScene 1 (東京駅): 改札口で立ち止まり、声をかけた女性を追う\nScene 2 (暗い路地): 女性の後ろ姿を確認する\nScene 3 (地下のバー): バーテンダーに祖母の話を聞く'
      }
    ]
  },
  {
    slug: 'easier_difficulty',
    label: 'Easier difficulty signal',
    messages: [
      {
        role: 'user',
        content: 'Scene 3 of ~12. Player chose: "駅員に話しかける". Continue.\nMystery state: The station attendant recognized the description of the woman in blue but acted nervous. He glanced toward the lockers before looking away.\nDifficulty: easier\nRecent history:\nScene 1 (東京駅): 改札口で立ち止まり、声をかけた女性を追う\nScene 2 (東京駅の改札口): 駅員に話しかける'
      }
    ]
  },
  {
    slug: 'reinforce_grammar',
    label: 'Scene 6 with grammar due for reinforcement',
    messages: [
      {
        role: 'user',
        content: 'Scene 6 of ~12. Player chose: "ノートのページをもう一度めくる". Continue.\nMystery state: The notebook\'s middle pages list dates that match the player\'s grandmother\'s visits to Tokyo. The woman in blue is watching from across the street.\nInventory: 古いノート\nDifficulty: standard\nGrammar covered this run (do not repeat): 【〜ばかり】just did | 【〜らしい】seems/apparently | 【〜ようにする】make an effort to | 【〜たとたん】the moment that\nGrammar due for reinforcement (reuse ONE naturally, do NOT re-explain): 【〜らしい】 | 【〜たとたん】\nRecent history:\nScene 3 (古い煙草屋): おじいさんに話しかける\nScene 4 (駅のロッカー): ロッカー番号を試してみる\nScene 5 (古い本屋): 本棚の裏を確かめる'
      }
    ]
  },
  {
    slug: 'long_history',
    label: 'Scene 8 with full history and rich memo',
    messages: [
      {
        role: 'user',
        content: 'Scene 8 of ~12. Player chose: "地下通路へ進む". Continue.\nMystery state: The map in the notebook leads to a wartime underground passage beneath Shinjuku. The woman in blue is the player\'s grandmother\'s former student. The man in grey has stopped following — he now seems to be guiding the player deliberately. Three NPCs (shopkeeper: frightened/closed off, bartender: quietly helpful, shrine priest: formally cryptic) each revealed a different piece of the grandmother\'s story.\nInventory: 古いノート、コインロッカーの鍵、神社のお守り\nDifficulty: standard\nRecent history:\nScene 4 (駅のロッカー): ロッカー番号を試してみる\nScene 5 (古い本屋): 本棚の裏を確かめる\nScene 6 (神社の境内): 神主に話しかける\nScene 7 (地下のバー): バーテンダーに地図を見せる'
      }
    ]
  }
];
