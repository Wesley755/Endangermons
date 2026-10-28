module GamePlay
  class Bag
    # db_symbols of items that should close the bag when used in battle.
    # Replace with your item(s); delete the check below to close for ALL items.
    CLOSE_BAG_ITEMS = %i[:safari_ball].freeze

    private

    def use_item_in_battle
      item_id = @item_list[index = @index]
      return action_b if item_id.nil?
      return play_buzzer_se unless data_item(item_id).is_battle_usable

      play_decision_se
      db_symbol = data_item(item_id).db_symbol # read before the item is consumed
      wrapper = util_item_useitem(item_id)

      if wrapper
        @running = false # leave the bag screen
      else
        update_bag_ui_after_action(index)
      end
    end
  end
end