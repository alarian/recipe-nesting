function nest (recipes) {
  recipes = recipes.map(transformRecipe)

  // Transform the array into a id map to eliminate "find" calls,
  // which can be very slow if called on a big array
  recipes = toMap(recipes)

  // Nest all recipes
  for (let key in recipes) {
    recipes[key] = nestRecipe(recipes[key], recipes)
  }

  // Remove the internal flag for nested recipes
  for (let key in recipes) {
    delete recipes[key]['nested']
  }

  return Object.values(recipes)
}

function toMap (recipes) {
  let recipeMap = []
  recipes.map(recipe => recipeMap[recipe.id] = recipe)
  return recipeMap
}

function transformRecipe (recipe) {
  let components = recipe.ingredients.map(i => ({id: i.item_id, quantity: i.count}))

  if (recipe.guild_ingredients) {
    let guildIngredients = recipe.guild_ingredients.map(i => ({
      id: i.upgrade_id,
      quantity: i.count,
      guild: true
    }))
    components = components.concat(guildIngredients)
  }

  let transformed = {
    id: recipe.output_item_id,
    output: recipe.output_item_count,
    components: components,
    min_rating: recipe.min_rating !== undefined ? recipe.min_rating : null,
    disciplines: recipe.disciplines || []
  }

  if (recipe.output_upgrade_id) {
    transformed.upgrade_id = recipe.output_upgrade_id
  }

  if (recipe.output_item_count_range) {
    transformed.output_range = recipe.output_item_count_range
  }

  if (recipe.achievement_id) {
    transformed.achievement_id = recipe.achievement_id
  }

  return transformed
}

function nestRecipe (recipe, recipes) {
  // This recipe was already nested as a part of another recipe
  if (recipe.nested) {
    return recipe
  }

  // Calculate this recipe and all sub-components
  recipe.nested = true
  recipe.quantity = recipe.quantity || 1
  recipe.components = recipe.components.map(component => {
    let index = !component.guild
      ? component.id
      : recipes.findIndex(x => x && x.upgrade_id === component.id)

    // Try and find the component in the recipes. If we cant find it,
    // either give back the raw component or discard if it's a guild upgrade
    if (!recipes[index]) {
      return !component.guild ? component : false
    }

    // The component is the recipe! Abort! D:
    if (recipe.id === index) {
      return !component.guild ? component : {id: recipe.id, quantity: component.quantity}
    }

    // The component recipe is not nested yet, so we nest it now!
    if (!recipes[index].nested) {
      recipes[index] = nestRecipe(recipes[index], recipes)
    }

    // Make sure we use a copy of the object, and insert it into the components
    let ingredientRecipe = {...recipes[index]}
    ingredientRecipe.quantity = component.quantity
    delete ingredientRecipe.nested

    return ingredientRecipe
  })

  // Filter guild components that we don't have in our recipes :(
  recipe.components = recipe.components.filter(x => x)

  // Sort components so that non-craftable components are always on top
  recipe.components.sort((a, b) => (a.components ? 1 : 0) - (b.components ? 1 : 0))

  // Throw out the components if they are empty (= only non-matched guild recipes)
  if (recipe.components.length === 0) {
    delete recipe.components
  }

  return recipe
}

module.exports = nest
