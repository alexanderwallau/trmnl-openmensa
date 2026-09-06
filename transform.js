// OpenMensa feed -> today's meals, flat.
// Accepts what TRMNL hands us for either source shape: the openmensa.org API v2
// (array of days, or a bare array of meals) or an OpenMensa Feed v2 XML document.
// ponytail: one tolerant walker instead of a parser per format — TRMNL's XML->hash
// mapping isn't documented, so text/attribute lookups try the common conventions.

var MEAT = /fleisch|fisch|schwein|rind|gefl(ü|ue)gel|huhn|h(ä|ae)hnchen|pute|lamm|kalb|wild|gelatine|krebstier|weichtier|meat|fish|pork|beef|poultry|chicken|turkey|veal|game|gelatin|crustacean|mollusc/i;
var ANIMAL = /milch|laktose|\bei(er)?\b|honig|butter|sahne|k(ä|ae)se|milk|lactose|\begg|honey|cheese|cream/i;
var GLUTEN = /gluten|weizen|dinkel|roggen|gerste|hafer|wheat|spelt|rye|barley|oat/i;
var ADDITIVE = /^\s*\d|farbstoff|konservierung|antioxidation|geschmacksverst|geschwefelt|geschw(ä|ae)rzt|phosphat|s(ü|ue)(ß|ss)ungsmittel|colou?r|preservative|antioxidant|flavour enhancer|sweetener|waxed/i;

function transform(input) {
  function txt(v) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'object') return String(v);
    var c = v.__content__ || v.content || v.text || v._;
    return c === undefined || c === null ? '' : String(c);
  }
  function arr(v) {
    if (v === null || v === undefined) return [];
    return Array.isArray(v) ? v : [v];
  }
  function attr(node, name) {
    if (!node || typeof node !== 'object') return '';
    var bag = node.$ || node.attributes || {};
    var v = node[name] !== undefined ? node[name] : (node['@' + name] !== undefined ? node['@' + name] : bag[name]);
    return typeof v === 'object' ? txt(v) : (v === undefined || v === null ? '' : String(v));
  }
  function money(v) {
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? '' : n.toFixed(2);
  }

  // ponytail: UTC date. Canteens serve at midday, so the 1-2h skew to CET only
  // mislabels the day between midnight and 02:00, and the next poll fixes it.
  var today = new Date().toISOString().slice(0, 10);

  var days;
  if (Array.isArray(input)) {
    // bare meals array (…/days/<date>/meals) vs array of days (…/meals)
    days = (input.length && input[0] && input[0].prices) ? [{ date: today, meals: input }] : input;
  } else {
    var root = (input && input.openmensa) || input || {};
    var canteen = root.canteen || root;
    days = arr(canteen.day || canteen.days);
  }

  var day = null;
  for (var i = 0; i < days.length; i++) {
    if (attr(days[i], 'date') === today) { day = days[i]; break; }
  }

  var pairs = [];
  if (day) {
    if (Array.isArray(day.meals)) {
      for (var j = 0; j < day.meals.length; j++) pairs.push([String(day.meals[j].category || ''), day.meals[j]]);
    } else {
      arr(day.category).forEach(function (cat) {
        arr(cat.meal).forEach(function (m) { pairs.push([attr(cat, 'name'), m]); });
      });
    }
  }

  var meals = pairs.map(function (pair) {
    var category = pair[0], m = pair[1];
    var name = txt(m.name).replace(/\s+/g, ' ').trim();

    var notes = [];
    arr(m.notes).concat(arr(m.note)).forEach(function (n) {
      txt(n).split(/\s*,\s*/).forEach(function (s) { if (s.trim()) notes.push(s.trim()); });
    });

    var prices = { student: '', staff: '', guest: '' };
    if (m.prices) {
      prices.student = money(m.prices.students !== undefined && m.prices.students !== null ? m.prices.students : m.prices.pupils);
      prices.staff = money(m.prices.employees);
      prices.guest = money(m.prices.others);
    }
    arr(m.price).forEach(function (p) {
      var role = attr(p, 'role'), value = money(txt(p));
      if (/student|pupil/i.test(role)) prices.student = value;
      else if (/employee|staff/i.test(role)) prices.staff = value;
      else if (/other|guest/i.test(role)) prices.guest = value;
    });

    var haystack = name + ' ' + category + ' ' + notes.join(' ');
    var vegan = /vegan/i.test(category) || /\bvegan\b/i.test(name);
    var vegetarian = vegan || /vegetarisch|vegetarian|veggie/i.test(category + ' ' + name);
    if (!vegetarian) vegetarian = !MEAT.test(haystack);
    if (!vegan) vegan = vegetarian && !ANIMAL.test(haystack);

    var allergens = notes.filter(function (n) { return !ADDITIVE.test(n); });
    return {
      name: name,
      category: category,
      prices: prices,
      vegan: vegan,
      vegetarian: vegetarian,
      glutenfree: !GLUTEN.test(haystack),
      allergens: allergens,
      key_allergens: allergens.filter(function (n) { return MEAT.test(n) || ANIMAL.test(n); }),
      additives: notes.filter(function (n) { return ADDITIVE.test(n); })
    };
  });

  return {
    date: today,
    closed: !day || meals.length === 0 || (day.closed !== undefined && day.closed !== false && day.closed !== 'false'),
    count: meals.length,
    meals: meals
  };
}
