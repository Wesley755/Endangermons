puts 'Enounter patch file loaded'

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

    # bool, whether or not the bait has been used in the encounter
    $status = 'default'

    def player_action_choice_internal(choice)
      return original_player_action_choice_internal(choice) unless choice == :bag

      @next_update = :item_choice
    end

    # Safari version of the base item_choice: same flow, but the wild
    # Pokemon's turn (and flee check) follows instead of the AI phase
    def item_choice
      user = @logic.battler(0, @player_actions.size)
      item_wrapper = @visual.show_item_choice
      bag = user.bag
      if item_wrapper
        @next_update = :pokemon_turn
        return if special_item_choice_action(item_wrapper)
        @player_actions << Actions::Item.new(self, item_wrapper, bag, user)
        if item_wrapper.item.is_limited
          bag.remove_item(item_wrapper.item.db_symbol, 1)
          @logic.player_processing_item << item_wrapper.item
        end
        log_debug("Action : #{@player_actions.last}") if debug?
      else
        @next_update = :player_action_choice
      end
    end

    # return the item ID of the animal's preferred bait
    def preferred_bait
      if  @safari_pokemon.db_symbol == :giant_panda
        return :apple
      else
        return :poke_ball
      end
    end

    # gives the "status" of the animal (text from the Observe action)
    def check_status
      if $status == 'bait used'
        return 'you have used a bait on the creature!'
      else
        return 'no status to report'
      end
    end

    # overrides safari catching mechanic
    def try_safari_catch
      observe
    end

    # logic for "observe" option.
    def observe
      if @safari_pokemon.db_symbol == :giant_panda
        if $status == 'bait used'
          display_message_and_wait('She seems to have calmed down significantly.')
        else
          display_message_and_wait('She is weak, but agitated. Maybe if she had something to eat, she would calm down...')
        end
      end
      @next_update = :player_action_choice
    end
    # override the "bait" function for our purposes
    def throw_bait
      if $bag.contain_item?(preferred_bait)
        $bag.remove_item(preferred_bait, 1)
        @visual.show_bait_mud_animation(@safari_pokemon, :bait)
        @message_window.wait_input = true
        display_message_and_wait(throw_bait_message)
        $status = 'bait used'
      else
        @message_window.wait_input = true
        display_message_and_wait("You don't have the right bait!")
      end
      @next_update = :trigger_all_AI
    end

    # changes for the animal's turn
    def pokemon_turn
      display_message_and_wait(check_status)
      @next_update = :player_action_choice
    end
  end
end
