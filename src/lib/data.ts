import type { Food, Meal, Profile } from "./types"
import { slug } from "./utils"

// name | category | kcal | protein | carbs | fat | fiber (per 100 g) | serving g | serving label
const FOOD_ROWS = `Apple|fruit|52|0.3|13.8|0.2|2.4|180|1 medium
Banana|fruit|89|1.1|22.8|0.3|2.6|120|1 medium
Orange|fruit|47|0.9|11.8|0.1|2.4|150|1 medium
Clementine|fruit|47|0.9|12|0.2|1.7|75|1 fruit
Pear|fruit|57|0.4|15.2|0.1|3.1|180|1 medium
Kiwi|fruit|61|1.1|14.7|0.5|3|75|1 fruit
Strawberries|fruit|32|0.7|7.7|0.3|2|150|1 cup
Blueberries|fruit|57|0.7|14.5|0.3|2.4|150|1 cup
Raspberries|fruit|52|1.2|11.9|0.7|6.5|125|1 cup
Grapes|fruit|69|0.7|18.1|0.2|0.9|150|1 cup
Mango|fruit|60|0.8|15|0.4|1.6|165|1 cup
Pineapple|fruit|50|0.5|13.1|0.1|1.4|165|1 cup
Peach|fruit|39|0.9|9.5|0.3|1.5|150|1 medium
Watermelon|fruit|30|0.6|7.6|0.2|0.4|280|1 slice
Pomegranate seeds|fruit|83|1.7|18.7|1.2|4|90|½ cup
Fresh figs|fruit|74|0.8|19.2|0.3|2.9|50|1 fig
Dates, dried|fruit|282|2.5|75|0.4|8|24|3 dates
Raisins|fruit|299|3.1|79.2|0.5|3.7|30|1 handful
Avocado|fruit|160|2|8.5|14.7|6.7|100|½ avocado
Broccoli|veg|34|2.8|6.6|0.4|2.6|150|1 portion
Carrot|veg|41|0.9|9.6|0.2|2.8|80|1 medium
Tomato|veg|18|0.9|3.9|0.2|1.2|120|1 medium
Cucumber|veg|15|0.7|3.6|0.1|0.5|150|½ cucumber
Green salad|veg|15|1.4|2.9|0.2|1.3|50|1 bowl
Spinach|veg|23|2.9|3.6|0.4|2.2|100|1 portion
Zucchini|veg|17|1.2|3.1|0.3|1|200|1 medium
Bell pepper|veg|31|1|6|0.3|2.1|120|1 medium
Onion|veg|40|1.1|9.3|0.1|1.7|100|1 medium
Green beans|veg|31|1.8|7|0.2|2.7|150|1 portion
Mushrooms|veg|22|3.1|3.3|0.3|1|100|1 portion
Eggplant|veg|25|1|5.9|0.2|3|200|½ eggplant
Cauliflower|veg|25|1.9|5|0.3|2|150|1 portion
Potato, boiled|veg|87|1.9|20.1|0.1|1.8|200|1 large
Sweet potato, baked|veg|90|2|20.7|0.2|3.3|150|1 medium
Green peas, cooked|veg|84|5.4|15.6|0.2|5.5|100|1 portion
Sweet corn|veg|96|3.4|21|1.5|2.4|100|1 portion
White rice, cooked|grain|130|2.7|28.2|0.3|0.4|150|1 portion
Brown rice, cooked|grain|123|2.7|25.6|1|1.6|150|1 portion
Pasta, cooked|grain|158|5.8|30.9|0.9|1.8|180|1 plate
Whole-wheat pasta, cooked|grain|124|5.3|26.5|0.5|4.5|180|1 plate
Couscous, cooked|grain|112|3.8|23.2|0.2|1.4|150|1 portion
Quinoa, cooked|grain|120|4.4|21.3|1.9|2.8|150|1 portion
Bulgur, cooked|grain|83|3.1|18.6|0.2|4.5|150|1 portion
Rolled oats, dry|grain|379|13.2|67.7|6.5|10.1|40|½ cup
Baguette|grain|270|9|55|1.3|2.6|60|¼ baguette
Whole-grain bread|grain|247|13|41|3.4|7|35|1 slice
White sandwich bread|grain|266|7.6|49|3.3|2.7|28|1 slice
Croissant|grain|406|8.2|45.8|21|2.6|60|1 croissant
Pain au chocolat|grain|420|7.5|46|22|2.6|65|1 pastry
Flour tortilla wrap|grain|306|8.2|50|8|3.5|60|1 wrap
Granola|grain|471|10|64|20|7|50|½ cup
Corn flakes|grain|357|7.5|84|0.4|3.3|30|1 bowl
Rice cakes|grain|387|8.2|81.5|2.8|4.2|9|1 cake
Chicken breast, cooked|protein|165|31|0|3.6|0|120|1 fillet
Chicken thigh, cooked|protein|209|26|0|10.9|0|120|2 thighs
Turkey breast, cooked|protein|147|30.1|0|2.1|0|120|1 portion
Lean ground beef 5%, cooked|protein|164|25.8|0|6.4|0|100|1 portion
Ground beef 15%, cooked|protein|250|25.9|0|15.4|0|100|1 portion
Beef steak, cooked|protein|200|29|0|9|0|150|1 steak
Lamb leg, cooked|protein|191|28.3|0|7.7|0|120|1 portion
Merguez sausage|protein|290|15|1|25|0|50|1 sausage
Cooked ham|protein|115|20|1|3.5|0|40|1 slice
Salmon, cooked|protein|206|22.1|0|12.4|0|130|1 fillet
Tuna in water, drained|protein|116|25.5|0|0.8|0|100|1 small can
Cod, cooked|protein|105|22.8|0|0.9|0|150|1 fillet
Shrimp, cooked|protein|99|24|0.2|0.3|0|100|1 portion
Sardines in oil, drained|protein|208|24.6|0|11.5|0|90|1 can
Egg|protein|143|12.6|0.7|9.5|0|50|1 large egg
Egg white|protein|52|10.9|0.7|0.2|0|33|1 white
Firm tofu|protein|144|17.3|2.8|8.7|2.3|100|1 portion
Lentils, cooked|protein|116|9|20.1|0.4|7.9|150|1 portion
Chickpeas, cooked|protein|164|8.9|27.4|2.6|7.6|150|1 portion
Kidney beans, cooked|protein|127|8.7|22.8|0.5|6.4|150|1 portion
Hummus|protein|166|7.9|14.3|9.6|6|30|2 tbsp
Whey protein powder|protein|400|80|8|6|0|30|1 scoop
Whole milk|dairy|61|3.2|4.8|3.3|0|250|1 glass
Semi-skimmed milk|dairy|46|3.3|4.8|1.6|0|250|1 glass
Skimmed milk|dairy|34|3.4|5|0.1|0|250|1 glass
Plain yogurt|dairy|61|3.5|4.7|3.3|0|125|1 pot
Greek yogurt 0%|dairy|59|10.2|3.6|0.4|0|150|1 pot
Greek yogurt, full-fat|dairy|97|9|4|5|0|150|1 pot
Skyr|dairy|63|11|4|0.2|0|150|1 pot
Fromage blanc 0%|dairy|46|7.5|3.9|0.2|0|100|1 portion
Cottage cheese|dairy|98|11.1|3.4|4.3|0|100|½ cup
Cheddar|dairy|403|24.9|1.3|33.1|0|30|1 slice
Camembert|dairy|300|19.8|0.5|24.3|0|30|1 wedge
Emmental|dairy|380|28.5|0|29.5|0|30|1 slice
Mozzarella|dairy|254|18|1.5|19.5|0|60|½ ball
Feta|dairy|264|14.2|4.1|21.3|0|30|1 slice
Butter|dairy|717|0.9|0.1|81.1|0|10|1 pat
Crème fraîche 30%|dairy|292|2.4|2.8|30|0|15|1 tbsp
Olive oil|fat|884|0|0|100|0|13|1 tbsp
Almonds|fat|579|21.2|21.6|49.9|12.5|30|1 handful
Walnuts|fat|654|15.2|13.7|65.2|6.7|30|1 handful
Cashews|fat|553|18.2|30.2|43.9|3.3|30|1 handful
Pistachios|fat|560|20.2|27.2|45.3|10.6|30|1 handful
Peanuts|fat|567|25.8|16.1|49.2|8.5|30|1 handful
Peanut butter|fat|588|25|20|50|6|16|1 tbsp
Chia seeds|fat|486|16.5|42.1|30.7|34.4|15|1 tbsp
Olives|fat|145|1|3.8|15.3|3.3|30|8 olives
Mayonnaise|fat|680|1|0.6|75|0|15|1 tbsp
Dark chocolate 70%|snack|598|7.8|45.9|42.6|10.9|20|2 squares
Milk chocolate|snack|535|7.7|59.4|29.7|3.4|20|2 squares
Honey|snack|304|0.3|82.4|0|0.2|21|1 tbsp
Sugar|snack|387|0|100|0|0|5|1 tsp
Jam|snack|278|0.4|68.9|0.1|1.1|20|1 tbsp
Chocolate chip cookie|snack|488|5.4|64|24|2.4|15|1 cookie
Potato chips|snack|536|7|53|34.6|4.4|30|1 small bag
Vanilla ice cream|snack|207|3.5|23.6|11|0.7|70|1 scoop
Baklava|snack|428|6.7|37.6|29|2.5|40|1 piece
Popcorn, air-popped|snack|387|12.9|77.8|4.5|14.5|20|2 cups
Protein bar|snack|350|30|35|10|5|60|1 bar
Orange juice|drink|45|0.7|10.4|0.2|0.2|250|1 glass
Cola|drink|42|0|10.6|0|0|330|1 can
Diet cola|drink|1|0|0|0|0|330|1 can
Coffee, black|drink|2|0.1|0|0|0|200|1 cup
Latte, semi-skimmed|drink|40|2.7|3.9|1.4|0|250|1 mug
Tea, unsweetened|drink|1|0|0.3|0|0|250|1 cup
Mint tea, sweetened|drink|27|0|6.7|0|0|150|1 glass
Almond milk, unsweetened|drink|15|0.6|0.3|1.2|0.2|250|1 glass
Beer|drink|43|0.5|3.6|0|0|330|1 bottle
Red wine|drink|85|0.1|2.6|0|0|150|1 glass
Pizza margherita|meal|245|10.5|30|9.5|2|125|1 slice
Lasagna|meal|150|8|14|7|1.2|300|1 portion
Burger|meal|254|13|25|11|1.5|200|1 burger
French fries|meal|312|3.4|41.4|14.7|3.8|120|1 medium
Couscous with meat & vegetables|meal|140|8|15|5|2|350|1 plate
Chicken tagine|meal|120|10|6|6|1.5|350|1 plate
Lentil soup|meal|80|4.5|12|1.5|3|300|1 bowl
Vegetable soup|meal|35|1.2|5.5|1|1.2|300|1 bowl
Shakshuka|meal|100|6|6|6|1.5|300|1 portion
Omelette, 2 eggs|meal|154|10.6|0.6|11.7|0|120|1 omelette
Ham & butter baguette|meal|259|11.4|36.9|7.2|1.8|150|1 sandwich`

export const FOODS: Food[] = FOOD_ROWS.trim().split("\n").map((line) => {
  const [name, cat, k, p, c, f, fb, sg, sl] = line.split("|")
  return { id: "b-" + slug(name), name, cat, k: +k, p: +p, c: +c, f: +f, fb: +fb, sg: +sg, sl }
})

export const CATS: [string, string][] = [
  ["all", "All"], ["mine", "My foods"], ["fruit", "Fruit"], ["veg", "Vegetables"], ["grain", "Bread & grains"],
  ["protein", "Meat, fish & legumes"], ["dairy", "Dairy"], ["fat", "Nuts & fats"], ["snack", "Sweets & snacks"],
  ["drink", "Drinks"], ["meal", "Dishes"],
]

export const MEALS: [Meal, string][] = [["breakfast", "Breakfast"], ["lunch", "Lunch"], ["dinner", "Dinner"], ["snacks", "Snacks"]]
export const mealName = (k: string) => (MEALS.find((m) => m[0] === k) || MEALS[0])[1]

export const ACTIVITY: [number, string, string][] = [
  [1.2, "Sedentary", "Desk job, little walking (under 5,000 steps)"],
  [1.375, "Lightly active", "On your feet part of the day (5,000–7,500 steps)"],
  [1.55, "Moderately active", "Active job or lots of walking (7,500–10,000 steps)"],
  [1.725, "Very active", "Physical job (10,000+ steps)"],
  [1.9, "Extremely active", "Hard physical labour all day"],
]

// MET values from the Compendium of Physical Activities
export const EXERCISES: [string, [string, string, number][]][] = [
  ["Cardio", [
    ["walk-slow", "Walking, slow (3 km/h)", 2.8], ["walk", "Walking, moderate (5 km/h)", 3.5], ["walk-brisk", "Walking, brisk (6.5 km/h)", 5],
    ["hike", "Hiking", 6], ["run-8", "Running, 8 km/h", 8.3], ["run-10", "Running, 10 km/h", 9.8], ["run-11", "Running, 11 km/h", 11],
    ["run-13", "Running, 13 km/h", 11.8], ["bike-easy", "Cycling, leisure (under 16 km/h)", 4], ["bike-mod", "Cycling, 19–22 km/h", 8],
    ["spin", "Stationary bike, moderate", 6.8], ["ellip", "Elliptical trainer", 5], ["row", "Rowing machine, moderate", 7],
    ["stairs", "Stair climber", 9], ["rope", "Jump rope", 11.8], ["swim-easy", "Swimming, easy", 6], ["swim-hard", "Swimming, fast laps", 9.8],
    ["dance", "Dance fitness / Zumba", 6.5],
  ]],
  ["Strength & mobility", [
    ["weights", "Weight training, moderate", 3.5], ["weights-hard", "Weight training, vigorous", 6], ["hiit", "HIIT / circuit training", 8],
    ["pilates", "Pilates", 3], ["yoga", "Yoga", 2.5], ["stretch", "Stretching", 2.3],
  ]],
  ["Sports", [
    ["tennis", "Tennis", 7.3], ["football", "Football, casual", 7], ["basket", "Basketball", 6.5], ["boxing", "Boxing, bag work", 5.5],
    ["martial", "Martial arts", 10.3], ["climb", "Climbing", 7.5],
  ]],
  ["Everyday", [["clean", "Housework, cleaning", 3.3], ["garden", "Gardening", 3.8], ["errands", "Errands on foot", 2.3]]],
]
export const EX_INDEX: Record<string, { name: string; met: number }> = {}
EXERCISES.forEach(([, list]) => list.forEach(([id, name, met]) => { EX_INDEX[id] = { name, met } }))

export const DEFAULT_PROFILE: Profile = {
  sex: "female", dob: "1997-05-14", height: 165, weight: 70, goalWeight: 62, activity: 1.375,
  bodyFat: null, neck: null, waist: null, hip: null, goal: "lose", rate: 0.5, bmrFormula: "mifflin",
  proteinPerKg: 1.8, fatPct: 30, exCredit: 0.5, targetMode: "formula", customKcal: null,
  waterGoal: null, exGoal: 150, myQuotes: [],
}

/** Original motivational lines. One is picked per day; "Another one" cycles. */
export const QUOTES = [
  "Small steps every day add up to big changes.",
  "You don't have to be perfect. You just have to keep going.",
  "Every healthy choice is a vote for the woman you're becoming.",
  "Slow progress is still progress.",
  "Your body hears everything your mind says. Speak kindly.",
  "Consistency beats intensity, every single time.",
  "One meal doesn't define you. The next one is a fresh start.",
  "Strong is a feeling, not a size.",
  "Drink your water, log your meals, trust the process.",
  "You are not starting over. You are starting from experience.",
  "Rest is part of the plan, not a break from it.",
  "Feed your body like someone you love.",
  "Today's effort is tomorrow's strength.",
  "The scale measures weight, not worth.",
  "Good habits are built one ordinary day at a time.",
  "Be proud of how far you've come and patient with how far you'll go.",
  "Movement is a celebration of what your body can do.",
  "You showed up today. That counts.",
  "Nourish, move, rest, repeat.",
  "Celebrate the small wins. They're big wins in disguise.",
  "Your pace is the right pace.",
  "Every workout is a promise kept to yourself.",
  "Healthy is a lifestyle, not a deadline.",
  "Choose progress over excuses and kindness over guilt.",
  "A balanced plate makes a balanced day.",
  "You are worth the effort you put in.",
  "Glow from within: water, sleep, good food, movement.",
  "Bad days happen. Keep your streak of trying.",
  "Your goals are valid, and so is your rest.",
  "Confidence grows every time you keep a promise to yourself.",
  "Fuel your body, free your mind.",
  "Trust the trend, not one weigh-in.",
  "Make yourself a priority. You deserve it.",
  "Soft heart, strong body, steady mind.",
  "Every glass of water is a small act of self-care.",
  "Eat for energy, move for joy.",
  "Show up for yourself the way you show up for others.",
  "Gentle with yourself, serious about your goals.",
  "Your future self is cheering for you.",
  "Bloom at your own pace.",
]

export function quoteIndex(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
/** Your own quotes first, then the built-in ones. */
export function quoteList(mine: string[] | undefined) {
  return [...(mine || []).filter((q) => q.trim()), ...QUOTES]
}
