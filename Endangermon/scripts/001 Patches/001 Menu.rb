module GamePlay
    class Menu
        clear_previous_registers
        register_button(:open_dex) { false }
        register_button(:open_party) { false }
        register_button(:open_bag) { !$bag.locked }
        register_button(:open_tcard) { false }
        register_button(:open_option) { true }
        register_button(:open_save) { !$game_system.save_disabled }
        register_button(:open_quit) { true }
    end
end