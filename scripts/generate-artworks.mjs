import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../public/images/spring')

const API_KEY = process.env.MINIMAX_API_KEY
if (!API_KEY) {
  console.error('Set MINIMAX_API_KEY env var')
  process.exit(1)
}

const prompts = [
  '一幅小学四年级学生手绘的春天场景，蜡笔画风格，画面中有明亮的太阳、绿色草地和五颜六色的花朵，天空是蓝色的，有白云',
  '小学生用水彩笔画的春天花园，画面中有蝴蝶在花丛中飞舞，色彩鲜艳活泼，儿童画风格',
  '四年级学生画的春雨场景，画面中有小朋友打着伞在雨中行走，路边有水坑和嫩芽，水彩画风格',
  '小学生手绘的春天郊游，画面中有小朋友在草地上放风筝，远处有青山绿水，蜡笔画风格',
  '儿童画风格的春天树木发芽场景，一棵大树长出嫩绿色新叶，树下有小花和小草，色彩明亮',
  '小学生画的燕子归来场景，蓝天白云下几只燕子在飞翔，地面上有绿色田野和小河，蜡笔风格',
  '四年级学生画的春天小河边，河水清澈有小鱼游动，河边有柳树发芽，岸上开满桃花',
  '小学生画的春天农场，有农民伯伯在播种，远处有绿色的小山丘，画面色彩丰富温暖',
  '儿童画风格的春天公园，有小朋友在荡秋千，公园里樱花盛开，粉色和绿色为主色调',
  '小学生蜡笔画的春天早晨，画面中有公鸡在打鸣，太阳刚升起，院子里有鲜花盛开',
  '四年级学生画的春天野餐场景，几个小朋友坐在草地上吃东西，周围有蝴蝶和花朵',
  '小学生水彩画的春天彩虹，雨后天空出现彩虹，地面湿漉漉的有倒影，色彩鲜艳',
  '儿童画风格的春天菜园，画面中有各种蔬菜幼苗破土而出，有蚯蚓和瓢虫，绿色为主',
  '小学生画的春天池塘，池塘里有青蛙和蝌蚪，荷叶刚冒出水面，岸边有柳树',
  '四年级学生画的春天的家，房子被花草环绕，门前有小路和栅栏，烟囱冒着烟',
  '小学生蜡笔画的油菜花田，大片金黄色的油菜花铺满画面，远处有小山和蓝天',
  '儿童画风格的春天蜜蜂采蜜，大朵花旁有蜜蜂飞舞，阳光灿烂，色彩温暖',
  '小学生画的植树节，小朋友们在种树，有铲子和水桶，新栽的小树苗旁有浇水',
  '四年级学生画的春天的小鸟窝，树枝上有鸟巢和小鸟，鸟妈妈在喂虫子，蜡笔风格',
  '小学生水彩画的春天溪流，清澈的小溪从山间流过，两岸开满紫色和粉色野花',
  '儿童画风格的春天学校操场，小朋友在操场跑步，校园围墙边的树开花了',
  '小学生画的春天日出，太阳从山后升起，金色光芒照射在绿色田野上，色彩温暖',
  '四年级学生画的春天草地上的昆虫，有蚂蚁、瓢虫、蝴蝶，微观视角儿童画风格',
  '小学生蜡笔画的春天窗外风景，窗台上有花盆，窗外是盛开的樱花树和蓝天',
  '儿童画风格的春天海边，海滩上有贝壳和海星，远处有海浪和海鸥，色调清新',
  '小学生画的春天集市，路边摊卖鲜花和水果，人们穿着春装走来走去',
  '四年级学生画的春天风车，荷兰风格的风车在郁金香花田旁，色彩丰富明亮',
  '小学生水彩画的春天雨后蘑菇，草地上长出各种颜色的蘑菇，有阳光透过树叶',
  '儿童画风格的春天捉迷藏，小朋友在花丛和树后面躲藏，画面欢乐有趣',
  '小学生画的春天花店，店里摆满各种鲜花盆栽，门口有自行车和小狗',
  '四年级学生画的春天的山，层层叠叠的青山，山上有各色花朵，山脚有小村庄',
  '小学生蜡笔画的春天跳绳，几个小朋友在樱花树下跳绳，花瓣在空中飘散',
  '儿童画风格的春天气球，小朋友拿着彩色气球在花园里走，蓝天白云',
  '小学生画的春天的桥，一座小桥横跨小河，河边有垂柳和桃花，有人在桥上看风景',
  '四年级学生画的春天的猫，一只花猫在阳光下的花园里晒太阳，旁边有蝴蝶',
  '小学生水彩画的春天梨花，满树白色梨花盛开，树下有小兔子在吃草',
  '儿童画风格的春天足球赛，小朋友在绿色草坪上踢球，背景是开花的树和蓝天',
  '小学生画的春天帐篷露营，帐篷搭在花草地上，旁边有篝火和星星，温馨画面',
  '四年级学生画的春天的蜗牛，一只大蜗牛在花丛中爬行，背着彩色的壳，露珠闪亮',
  '小学生蜡笔画的春天教室窗外，窗户打开看到外面的花园和操场，桌上有花瓶',
  '儿童画风格的春天骑车，小朋友骑自行车在乡间小路上，两旁是油菜花和绿树',
  '小学生画的春天音乐会，小朋友在花园里弹吉他唱歌，周围有小动物在听',
  '四年级学生画的春天的鱼，池塘里五颜六色的锦鲤在游动，水面有睡莲和蜻蜓',
  '小学生水彩画的春天晚霞，傍晚天空呈现橙红色和紫色渐变，远处有归巢的鸟群',
]

const xiaoyu_prompt = '一幅小学生画的阴郁画面，画面主色调是深褐色和黑色，一棵光秃秃的枯树在灰暗天空下，没有叶子没有花，地面是深色的泥土，整体色调压抑沉重，蜡笔画风格'

async function generate(prompt, filename) {
  const filepath = path.join(outDir, filename)
  if (fs.existsSync(filepath)) {
    const stat = fs.statSync(filepath)
    if (stat.size > 5000) {
      console.log(`SKIP ${filename} (exists, ${(stat.size/1024).toFixed(0)}KB)`)
      return true
    }
  }

  try {
    const res = await fetch('https://api.minimaxi.com/v1/image/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'image-01',
        prompt,
        aspect_ratio: '3:4',
        n: 1
      })
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`FAIL ${filename}: ${res.status} ${text.slice(0, 200)}`)
      return false
    }

    const data = await res.json()
    const imgUrl = data?.data?.image_urls?.[0]
    if (!imgUrl) {
      console.error(`FAIL ${filename}: no image URL in response`, JSON.stringify(data).slice(0, 200))
      return false
    }

    const imgRes = await fetch(imgUrl)
    const buf = Buffer.from(await imgRes.arrayBuffer())
    fs.writeFileSync(filepath, buf)
    console.log(`OK   ${filename} (${(buf.length/1024).toFixed(0)}KB)`)
    return true
  } catch (err) {
    console.error(`FAIL ${filename}: ${err.message}`)
    return false
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })

  let ok = 0, fail = 0

  // Generate 林小雨's anomaly image
  const r = await generate(xiaoyu_prompt, 'pic-xiaoyu.png')
  if (r) ok++; else fail++

  // Generate 44 student artworks
  for (let i = 0; i < prompts.length; i++) {
    const filename = `pic-spring${i + 1}.png`
    const r = await generate(prompts[i], filename)
    if (r) ok++; else fail++

    // Rate limit: small delay between requests
    if (i < prompts.length - 1) await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone: ${ok} ok, ${fail} fail`)
}

main()
