module BattleUI
  class PlayerChoiceSafari
    class SubChoiceSafari
      # Y no longer shows the remaining Safari Balls
      def action_y
        # disabled
      end

      # Hide the Y ("Information") button prompt
      def update
        super
        @info_button.visible = false
        @x_button.visible = false
      end
    end
  end
end

module GamePlay
  class Bag
    # >>> Verify this id (see below) <<<
    OTHER_ITEMS_POCKET_ID = 1

    # Limit the bag to the Other Items tab.
    # @param modes [Array<Symbol>] bag modes to restrict
    def self.limit_pockets_to_other_items(modes = %i[menu battle hold shop])
      modes.each { |mode| POCKETS_PER_MODE[mode] = [OTHER_ITEMS_POCKET_ID] }
      # modes without their own entry (map, etc.) fall back to the default
      POCKETS_PER_MODE.default = [OTHER_ITEMS_POCKET_ID] if modes.include?(:menu)
    end
  end
end

GamePlay::Bag.limit_pockets_to_other_items