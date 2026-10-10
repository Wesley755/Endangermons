# PLEASE POKEMON SDK I NEED THIS
puts '[MUD->BAG PATCH] file loaded'

# 1) Make the third Safari button open the bag instead of throwing mud
module BattleUI
  class PlayerChoiceSafari
    def validate
      bounce_button
      case @index
      when 0 then success = choice_safari_ball
      when 1 then success = choice_bait
      when 2 then success = choice_bag   # was choice_mud
      when 3 then success = choice_flee
      else return
      end
      return show_flee_choice_failure unless success
      play_decision_se
    end
  end
end

# 2) Handle :bag in the Safari scene
module Battle
  class Safari
    alias_method :original_player_action_choice_internal, :player_action_choice_internal

    def player_action_choice_internal(choice)
      return original_player_action_choice_internal(choice) unless choice == :bag

      @next_update = :item_choice
    end

    # Safari version of the base item_choice: same flow, but the wild
    # Pokemon's turn (and flee check) follows instead of the AI phase
    def item_choice
      user = @logic.battler(0, @player_actions.size)
      item_wrapper = @visual.show_item_choice
      return @next_update = :player_action_choice unless item_wrapper # cancelled
      return if special_item_choice_action(item_wrapper) # balls / fleeing items

      @player_actions << Actions::Item.new(self, item_wrapper, user.bag, user)
      if item_wrapper.item.is_limited
        user.bag.remove_item(item_wrapper.item.db_symbol, 1)
        @logic.player_processing_item << item_wrapper.item
      end
      @next_update = :trigger_all_AI # see caveat below
    end
  end

  class Logic
    # Hooking into the turn-end actions where safari escape checks occur
    class SafariHandler # Note: Class name varies slightly depending on your PSDK version version (.25 / .26+)

      # Example override of the escape chance calculation
      alias original_flee_attempt_safari flee_attempt_safari if method_defined?(:flee_attempt_safari)

      def flee_attempt_safari(pokemon)
        # 1. Check your own conditions (e.g., a specific switch, or global variable)
        # If you want to completely disable Pokémon running away:
        return false

        # 2. Or, modify the base calculation:
        # Default often depends on Pokémon speed, angry/eating status, or fixed species rates
        base_flee_rate = pokemon.base_flee_rate # (Or your version's calculation factor)

        # Apply custom multipliers
        # e.g., cut the escape chance in half globally
        chance = base_flee_rate / 2

        # Roll the random check
        return rand(100) < chance
      end
    end
  end
end
