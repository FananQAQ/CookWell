/**
 * HowToCook 仓库内 markdown 相对路径（相对于 dishes/），当与
 * 「categoryKey/name/name.md」或「categoryKey/name.md」不一致时在此声明。
 * 键格式：categoryKey + '::' + data/dishes.js 中的菜名
 */
module.exports = {
  // HowToCook 目录第三字为 U+67F1，与 data/dishes 中「柑」(U+67FD) 不同，encode 后路径不一致
  'drink::耙耙柑茶': [
    'drink/\u8019\u8019\u67F1\u8336/\u8019\u8019\u67F1\u8336.md'
  ],
  'meat_dish::红烧肉': ['meat_dish/红烧肉/南派红烧肉.md'],
  'meat_dish::简易红烧肉': ['meat_dish/红烧肉/简易红烧肉.md'],
  'vegetable_dish::微波炉鸡蛋羹': ['vegetable_dish/鸡蛋羹/微波炉鸡蛋羹.md'],
  'vegetable_dish::蒸箱鸡蛋羹': ['vegetable_dish/鸡蛋羹/蒸箱鸡蛋羹.md'],
  'aquatic::烤鱼': ['aquatic/混合烤鱼/烤鱼.md'],
  'staple::电饭煲蒸米饭': ['staple/米饭/电饭煲蒸米饭.md'],
  'staple::煮锅蒸米饭': ['staple/米饭/煮锅蒸米饭.md'],
  'staple::芝麻烧饼': ['staple/烧饼/芝麻烧饼.md']
}
